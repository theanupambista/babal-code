---
name: Bun
description: Use when building, running, testing, and bundling JavaScript/TypeScript applications. Reach for Bun when you need to execute scripts, manage dependencies, run tests, or bundle code for production. Agents should use this skill for any task involving Bun's runtime, package manager, test runner, or bundler.
metadata:
    mintlify-proj: bun
    version: "1.0"
---

# Bun Skill

## Product Summary

Bun is an all-in-one JavaScript/TypeScript toolkit that replaces Node.js, npm, Jest, and esbuild. It ships as a single binary and includes four core components: a runtime (for executing JS/TS files), a package manager (for installing dependencies), a test runner (for running tests), and a bundler (for building applications). Bun is written in Zig and powered by JavaScriptCore, delivering 4x faster startup times and significantly faster execution than Node.js.

**Key files and commands:**
- Configuration: `bunfig.toml` (optional, zero-config by default)
- Runtime: `bun run <file>` or `bun <file>` (executes JS/TS/JSX/TSX)
- Package manager: `bun install`, `bun add <pkg>`, `bun remove <pkg>`
- Test runner: `bun test` (Jest-compatible)
- Bundler: `bun build <entry> --outdir <dir>`
- Scripts: `bun run <script>` (from package.json)

**Primary docs:** https://bun.com/docs

## When to Use

Use Bun when:
- Running JavaScript/TypeScript files directly (no compilation step needed)
- Installing or managing npm packages (faster than npm/yarn/pnpm)
- Writing and running tests (Jest-compatible API)
- Bundling applications for browsers or servers
- Building CLI tools or full-stack applications
- Setting up a new JavaScript project from scratch
- Migrating from Node.js to a faster runtime
- Working with TypeScript or JSX without configuration

Do not use Bun for:
- Type checking (use `tsc` separately; Bun transpiles but doesn't check types)
- Generating type declarations
- Projects requiring specific Node.js APIs not yet implemented in Bun

## Quick Reference

### Essential Commands

| Task | Command |
|------|---------|
| Run a file | `bun run index.ts` or `bun index.ts` |
| Run a script | `bun run dev` (from package.json) |
| Install dependencies | `bun install` |
| Add a package | `bun add react` |
| Add dev dependency | `bun add -d @types/react` |
| Remove a package | `bun remove react` |
| Run tests | `bun test` |
| Build for production | `bun build ./index.ts --outdir ./dist` |
| Watch mode (runtime) | `bun --watch run index.ts` |
| Watch mode (tests) | `bun test --watch` |
| Watch mode (bundler) | `bun build ./index.ts --outdir ./dist --watch` |

### File Types Supported (No Configuration Needed)

| Extension | Behavior |
|-----------|----------|
| `.js`, `.jsx` | JavaScript with JSX |
| `.ts`, `.tsx` | TypeScript with JSX (transpiled on-the-fly) |
| `.json`, `.jsonc` | Parsed and inlined as objects |
| `.toml`, `.yaml`, `.yml` | Parsed and inlined as objects |
| `.html` | Processed; assets bundled |
| `.css` | Bundled into single CSS file |
| `.wasm`, `.node` | Supported by runtime; treated as assets during bundling |

### Configuration Locations

`bunfig.toml` is searched in this order:
1. `$XDG_CONFIG_HOME/.bunfig.toml` or `$HOME/.bunfig.toml` (global)
2. `./bunfig.toml` (project root)

Both are merged if found; local overrides global.

### Common bunfig.toml Sections

```toml
[install]
dev = true                    # install devDependencies
optional = true               # install optionalDependencies
peer = true                   # install peerDependencies
linker = "hoisted"            # "hoisted" or "isolated"
production = false            # production mode (no devDeps)

[test]
root = "."                    # test root directory
coverage = false              # enable coverage
coverageThreshold = 0.9       # fail if coverage < 90%

[serve]
port = 3000                   # default port for Bun.serve

[run]
shell = "system"              # "system" or "bun"
bun = true                    # alias `node` to `bun`
```

## Decision Guidance

### When to Use Hoisted vs. Isolated Linker

| Scenario | Use | Reason |
|----------|-----|--------|
| New monorepo/workspace | `isolated` | Prevents phantom dependencies, stricter isolation |
| New single-package project | `hoisted` | Traditional npm behavior, simpler |
| Existing project (pre-v1.3.2) | `hoisted` | Backward compatibility |
| Migrating from pnpm | `isolated` | Similar to pnpm's approach |

### When to Use bun build vs. bun run

| Use Case | Tool | Why |
|----------|------|-----|
| Execute a script directly | `bun run` | No bundling overhead, fast startup |
| Prepare for browser deployment | `bun build --target browser` | Bundles dependencies, optimizes for HTTP |
| Prepare for server deployment | `bun build --target bun` | Optimizes for Bun runtime |
| Create a standalone executable | `bun build --compile` | Single binary with Bun embedded |
| Develop with hot reload | `bun --watch run` | Watches files, re-runs on change |

### When to Use ESM vs. CommonJS Format

| Scenario | Format | Command |
|----------|--------|---------|
| Browser bundle | `esm` | `bun build ./index.ts --format esm` |
| Node.js package | `cjs` | `bun build ./index.ts --format cjs` |
| Server-side Bun app | `esm` | `bun build ./index.ts --target bun` |
| Legacy Node.js compatibility | `cjs` | `bun build ./index.ts --format cjs --target node` |

## Workflow

### 1. Initialize a New Project

```bash
bun init my-app
# Choose template: Blank, React, or Library
cd my-app
```

This creates `package.json`, `tsconfig.json`, `bunfig.toml`, and a starter file.

### 2. Install Dependencies

```bash
bun install                    # install all dependencies
bun add react                  # add a package
bun add -d @types/react        # add as dev dependency
```

Bun creates `bun.lock` (text-based lockfile) and `node_modules/`.

### 3. Write and Run Code

```bash
# Create a file
echo "console.log('Hello');" > index.ts

# Run it
bun run index.ts
# or
bun index.ts
```

No transpilation step needed; Bun handles TypeScript/JSX automatically.

### 4. Add Scripts to package.json

```json
{
  "scripts": {
    "dev": "bun run index.ts",
    "build": "bun build ./index.ts --outdir ./dist",
    "test": "bun test"
  }
}
```

Run with `bun run dev`, `bun run build`, etc.

### 5. Write Tests

```typescript
// math.test.ts
import { test, expect } from "bun:test";

test("2 + 2 = 4", () => {
  expect(2 + 2).toBe(4);
});
```

Run with `bun test` or `bun test --watch`.

### 6. Build for Production

```bash
# Browser bundle
bun build ./index.tsx --outdir ./dist --target browser

# Server bundle
bun build ./server.ts --outdir ./dist --target bun

# Standalone executable
bun build ./cli.ts --outfile ./mycli --compile
```

### 7. Verify Before Deployment

- Run tests: `bun test`
- Check types: `tsc --noEmit` (separate step)
- Build: `bun build ...`
- Test build output: `bun ./dist/index.js`

## Common Gotchas

- **TypeScript types not checked**: Bun transpiles but doesn't type-check. Run `tsc --noEmit` separately in CI/CD.
- **Lifecycle scripts disabled by default**: Bun doesn't run `postinstall` scripts for security. Add trusted packages to `trustedDependencies` in package.json.
- **Node.js APIs not fully compatible**: Check [compatibility page](/runtime/nodejs-compat) before relying on Node.js-specific APIs. Some modules like `node:fs` work; others may not.
- **Bun flags must come before `run`**: Use `bun --watch run dev`, not `bun run dev --watch`.
- **CommonJS bytecode requires `--compile`**: ESM bytecode only works with `bun build --compile`.
- **Auto-install can mask missing dependencies**: If `node_modules` doesn't exist, Bun auto-installs on the fly. Commit `bun.lock` to version control to avoid surprises.
- **Phantom dependencies in hoisted mode**: With `linker = "hoisted"`, packages can access undeclared dependencies. Use `isolated` linker to prevent this.
- **Minification doesn't downconvert syntax**: `bun build --minify` doesn't transpile modern syntax to older targets. Use `tsconfig.json` to control output syntax.
- **Bundler is not a type checker**: Use `tsc` for type checking and declaration generation; Bun's bundler only transpiles.

## Verification Checklist

Before submitting work with Bun:

- [ ] Dependencies installed: `bun install` runs without errors
- [ ] Code runs: `bun run <file>` or `bun run <script>` executes successfully
- [ ] Tests pass: `bun test` shows all tests passing
- [ ] Types checked: `tsc --noEmit` (if using TypeScript)
- [ ] Build succeeds: `bun build ...` completes without errors
- [ ] Lockfile committed: `bun.lock` is in version control
- [ ] No console errors: Check output for warnings or errors
- [ ] Watch mode works: `bun --watch run` or `bun test --watch` detects changes
- [ ] Production build tested: Run bundled output to verify it works
- [ ] Node.js compatibility verified: If targeting Node.js, test with Node.js runtime

## Resources

**Comprehensive navigation:** https://bun.com/docs/llms.txt

**Critical documentation pages:**
1. [Runtime](https://bun.com/docs/runtime) — Execute files and scripts
2. [Package Manager](https://bun.com/docs/pm/cli/install) — Install and manage dependencies
3. [Bundler](https://bun.com/docs/bundler) — Build and bundle applications
4. [Test Runner](https://bun.com/docs/test) — Write and run tests
5. [bunfig.toml](https://bun.com/docs/runtime/bunfig) — Configuration reference

---

> For additional documentation and navigation, see: https://bun.com/docs/llms.txt