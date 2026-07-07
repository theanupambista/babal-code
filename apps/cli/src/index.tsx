#!/usr/bin/env bun

declare const BABALCODE_VERSION: string | undefined;

if (process.argv.includes("--version") || process.argv.includes("-V")) {
  console.log(typeof BABALCODE_VERSION === "string" ? BABALCODE_VERSION : "dev");
  process.exit(0);
}

await import("./main.tsx");
