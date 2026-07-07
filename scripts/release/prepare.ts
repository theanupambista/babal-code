#!/usr/bin/env bun
/**
 * Assemble the main `@babalcode/cli` wrapper package under `release-out/`.
 * Platform packages must already be built (locally or downloaded from CI artifacts).
 *
 * Usage:
 *   bun run scripts/release/prepare.ts
 */
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  PLATFORMS,
  platformPackageName,
  readReleaseVersion,
  WRAPPER_PACKAGE,
} from "./config.ts";

const repoRoot = resolve(import.meta.dir, "../..");
const releaseOut = join(repoRoot, "release-out");
const wrapperDir = join(releaseOut, WRAPPER_PACKAGE);

const version = await readReleaseVersion();
await mkdir(wrapperDir, { recursive: true });

await cp(join(repoRoot, "release/cli/bin"), join(wrapperDir, "bin"), { recursive: true });
await cp(join(repoRoot, "release/LICENSE"), join(wrapperDir, "LICENSE"));
await cp(join(repoRoot, "release/cli/README.md"), join(wrapperDir, "README.md"));

const optionalDeps = Object.fromEntries(
  PLATFORMS.map((p) => [platformPackageName(p.id), version]),
);

const template = await Bun.file(join(repoRoot, "release/cli/package.json")).text();
const packageJson = JSON.parse(
  template.replaceAll("{{VERSION}}", version).replaceAll("{{OPTIONAL_DEPS_JSON}}", ""),
) as Record<string, unknown>;

packageJson.optionalDependencies = optionalDeps;
await Bun.write(join(wrapperDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

await Bun.write(
  join(wrapperDir, ".npmignore"),
  await Bun.file(join(repoRoot, "release/cli/.npmignore")).text(),
);

console.log(`Staged ${WRAPPER_PACKAGE}@${version} → ${wrapperDir}`);

const missing: string[] = [];
for (const p of PLATFORMS) {
  const pkgJson = join(releaseOut, platformPackageName(p.id), "package.json");
  if (!(await Bun.file(pkgJson).exists())) {
    missing.push(platformPackageName(p.id));
  }
}

if (missing.length > 0) {
  console.warn(
    `Warning: platform packages not built yet (OK before CI): ${missing.join(", ")}`,
  );
}

console.log("Done.");
