#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

declare const BABALCODE_VERSION: string | undefined;

if (process.argv.includes("--version") || process.argv.includes("-V")) {
  console.log(typeof BABALCODE_VERSION === "string" ? BABALCODE_VERSION : "dev");
  process.exit(0);
}

// `@opentui/core`'s tree-sitter syntax highlighting (markdown + code-fence
// rendering) runs in a Worker whose auto-detected path breaks once bundled
// into a standalone `bun build --compile` binary (upstream:
// https://github.com/anomalyco/opentui/issues/807). The release build stages
// a self-contained `parser.worker.js` next to the compiled executable
// (scripts/release/build.ts); point OpenTUI at it via the env var it already
// supports. No-op in dev, where the file doesn't exist next to the `bun`
// executable and OpenTUI resolves the worker from source instead.
const siblingWorker = join(dirname(process.execPath), "parser.worker.js");
if (!process.env.OTUI_TREE_SITTER_WORKER_PATH && existsSync(siblingWorker)) {
  process.env.OTUI_TREE_SITTER_WORKER_PATH = siblingWorker;
}

await import("./main.tsx");
