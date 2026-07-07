#!/usr/bin/env bun
/**
 * Publish all staged packages to the public npm registry.
 * Requires `NPM_TOKEN` in the environment (CI) or `npm login` locally.
 *
 * Usage:
 *   bun run scripts/release/publish.ts
 */
import { join, resolve } from "node:path";
import { PLATFORMS, platformPackageName, WRAPPER_PACKAGE } from "./config.ts";

const repoRoot = resolve(import.meta.dir, "../..");
const releaseOut = join(repoRoot, "release-out");

async function publishPackage(name: string): Promise<void> {
  const dir = join(releaseOut, name);
  if (!(await Bun.file(join(dir, "package.json")).exists())) {
    throw new Error(`Package not staged: ${name}`);
  }
  console.log(`Publishing ${name}…`);
  const proc = Bun.spawn(["npm", "publish", "--access", "public"], {
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`npm publish failed for ${name}`);
}

for (const platform of PLATFORMS) {
  await publishPackage(platformPackageName(platform.id));
}

await publishPackage(WRAPPER_PACKAGE);
console.log("All packages published.");
