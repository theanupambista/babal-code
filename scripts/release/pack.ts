#!/usr/bin/env bun
/**
 * Create `.tgz` archives for every staged package — dry-run publish verification.
 *
 * Usage:
 *   bun run scripts/release/pack.ts
 */
import { join, resolve } from "node:path";
import { PLATFORMS, platformPackageName, WRAPPER_PACKAGE } from "./config.ts";

const repoRoot = resolve(import.meta.dir, "../..");
const releaseOut = join(repoRoot, "release-out");

const packages = [WRAPPER_PACKAGE, ...PLATFORMS.map((p) => platformPackageName(p.id))];

for (const name of packages) {
  const dir = join(releaseOut, name);
  if (!(await Bun.file(join(dir, "package.json")).exists())) {
    console.warn(`Skip ${name}: not staged`);
    continue;
  }
  const proc = Bun.spawn(["npm", "pack", "--pack-destination", releaseOut], {
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`npm pack failed for ${name}`);
}

console.log("Packed to", releaseOut);
