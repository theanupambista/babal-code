#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const platform = process.platform;
const arch = process.arch;
const pkg = `@babalcode/cli-${platform}-${arch}`;

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-V")) {
  try {
    const self = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const { version } = JSON.parse(readFileSync(self, "utf8"));
    console.log(version);
    process.exit(0);
  } catch {
    console.log("unknown");
    process.exit(1);
  }
}

let binaryPath;
try {
  const pkgJson = require.resolve(`${pkg}/package.json`);
  const binDir = join(dirname(pkgJson), "bin");
  const binaryName = platform === "win32" ? "babalcode.exe" : "babalcode";
  binaryPath = join(binDir, binaryName);
} catch {
  console.error(
    `babalcode: no prebuilt binary for ${platform}-${arch}.\n` +
      `This usually means npm did not install the matching optional dependency (${pkg}).`,
  );
  process.exit(1);
}

const result = spawnSync(binaryPath, args, { stdio: "inherit" });
if (result.error) {
  console.error(`babalcode: failed to start: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
