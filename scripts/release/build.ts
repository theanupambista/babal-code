#!/usr/bin/env bun
/**
 * Compile the CLI for one platform and stage an npm-ready platform package under
 * `release-out/`. Run on the matching OS in CI (or locally for smoke tests).
 *
 * Usage:
 *   RELEASE_PLATFORM=win32-x64 bun run scripts/release/build.ts
 *   bun run release:build -- --platform=linux-x64
 */
import { chmod, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  ENTRYPOINT,
  getPlatform,
  opentuiPlatformPackage,
  platformPackageName,
  readReleaseVersion,
  ripgrepPlatformPackage,
  type PlatformConfig,
  type PlatformId,
} from "./config.ts";


const repoRoot = resolve(import.meta.dir, "../..");
const releaseOut = join(repoRoot, "release-out");

function parsePlatformArg(): PlatformId {
  const fromEnv = process.env.RELEASE_PLATFORM;
  const fromCli = process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1];
  const id = (fromCli ?? fromEnv) as PlatformId | undefined;
  if (!id) {
    throw new Error("Set RELEASE_PLATFORM or pass --platform=<id> (e.g. win32-x64)");
  }
  return getPlatform(id).id;
}

async function ensureCrossArchNativeDeps(platform: PlatformConfig): Promise<void> {
  const host = `${process.platform}-${process.arch}`;
  if (host === platform.id) return;

  const opentuiPkg = opentuiPlatformPackage(platform.id);
  const ripgrepPkg = ripgrepPlatformPackage(platform.id);
  console.log(`Installing cross-arch native deps for ${platform.id}: ${opentuiPkg}, ${ripgrepPkg}`);

  const proc = Bun.spawn(
    ["bun", "add", opentuiPkg, ripgrepPkg, "--optional", "--no-save"],
    { cwd: repoRoot, stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`bun add failed with exit code ${code}`);
}

async function resolveRipgrepBinary(platform: PlatformConfig): Promise<string> {
  const host = `${process.platform}-${process.arch}`;
  if (host === platform.id) {
    const proc = Bun.spawn(
      ["bun", "-e", "import { rgPath } from '@vscode/ripgrep'; console.log(rgPath)"],
      { cwd: join(repoRoot, "packages/engine"), stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      throw new Error(stderr.trim() || `ripgrep resolve failed (exit ${code})`);
    }
    return stdout.trim();
  }

  const pkg = ripgrepPlatformPackage(platform.id);
  const binaryPath = `bin/${platform.rgBinary}`;
  const proc = Bun.spawn(
    [
      "bun",
      "-e",
      `import { createRequire } from 'node:module'; const r = createRequire(import.meta.path); console.log(r.resolve('${pkg}/${binaryPath}'));`,
    ],
    { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(stderr.trim() || `Could not resolve ${pkg}/${binaryPath}`);
  }
  return stdout.trim();
}

async function compileCli(platform: PlatformConfig, version: string): Promise<string> {
  const outDir = join(releaseOut, ".build", platform.id);
  await mkdir(outDir, { recursive: true });
  const outfile = join(outDir, platform.cliBinary);

  const args = [
    "build",
    ENTRYPOINT,
    "--compile",
    `--target=${platform.bunTarget}`,
    `--outfile=${outfile}`,
    "--sourcemap=none",
    "--minify",
    "--production",
    `--define=BABALCODE_VERSION=${JSON.stringify(version)}`,
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
  ];
  if (platform.windowsHideConsole) args.push("--windows-hide-console");

  console.log(`Compiling ${platform.id} → ${outfile}`);
  const proc = Bun.spawn(["bun", ...args], { cwd: repoRoot, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`bun build failed with exit code ${code}`);

  return outfile;
}

async function stagePlatformPackage(
  platform: PlatformConfig,
  version: string,
  compiledPath: string,
): Promise<string> {
  const pkgDir = join(releaseOut, platformPackageName(platform.id));
  const binDir = join(pkgDir, "bin");
  await mkdir(binDir, { recursive: true });

  await Bun.write(join(binDir, platform.cliBinary), Bun.file(compiledPath));
  if (process.platform !== "win32") {
    await chmod(join(binDir, platform.cliBinary), 0o755);
  }

  const rgSource = await resolveRipgrepBinary(platform);
  await Bun.write(join(binDir, platform.rgBinary), Bun.file(rgSource));
  if (process.platform !== "win32") {
    await chmod(join(binDir, platform.rgBinary), 0o755);
  }

  const templatePath = join(repoRoot, "release/platform/package.json");
  const template = await Bun.file(templatePath).text();
  const packageJson = JSON.parse(
    template
      .replaceAll("{{VERSION}}", version)
      .replaceAll("{{PLATFORM_ID}}", platform.id)
      .replaceAll("{{PACKAGE_NAME}}", platformPackageName(platform.id)),
  ) as Record<string, unknown>;

  packageJson.os = platform.os;
  packageJson.cpu = platform.cpu;

  await Bun.write(join(pkgDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  await Bun.write(join(pkgDir, "LICENSE"), Bun.file(join(repoRoot, "release/LICENSE")));
  await Bun.write(join(pkgDir, ".npmignore"), "*\n!bin\n!package.json\n!LICENSE\n");

  console.log(`Staged ${platformPackageName(platform.id)}@${version} → ${pkgDir}`);
  return pkgDir;
}

const platformId = parsePlatformArg();
const platform = getPlatform(platformId);
const version = await readReleaseVersion();

await ensureCrossArchNativeDeps(platform);
const compiledPath = await compileCli(platform, version);
await stagePlatformPackage(platform, version, compiledPath);

console.log("Done.");
