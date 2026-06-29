# CLAUDE.md

This file provides guidance to agents when working with code in this repository.

## Runtime

This is a **Bun**-first project. Use `bun` for everything (running, installing, scripts) — not `node`, `npm`, `pnpm`, or `ts-node`. TypeScript and TSX run directly under Bun with no build/transpile step; there is no `dist/` output during development.

## Commands

Run from the repo root:

- `bun install` — install all workspace dependencies
- `bun run dev:server` — run the server with file watching
- `bun run dev:cli` — run the CLI with file watching
- `bun run start:server` / `bun run start:cli` — run without watching
- `bun run typecheck` — `tsc --noEmit` across every workspace (the only check that exists; there is no lint config and no test setup yet)

Per-app scripts live in `apps/<name>/package.json` and can be run with `bun run --cwd apps/<name> <script>`.

The CLI is also exposed as a `babalcode` bin (`apps/cli/package.json`).

## Architecture

Bun-workspace monorepo. Members are globbed from `apps/*` (see root `package.json` `workspaces`). Two independent apps share config but not code:

- **`apps/server`** (`@babalcode/server`) — a [Hono](https://hono.dev) HTTP app. `src/index.ts` exports the default `{ port, fetch }` object Bun's server expects; port comes from `PORT` env (default 3000). Routes are registered directly on the `Hono` instance.
- **`apps/cli`** (`@babalcode/cli`) — a terminal UI built with [OpenTUI](https://github.com/sst/opentui) + React 19.

### TypeScript config

All apps extend `tsconfig.base.json`, which sets Bun-oriented strict options: `moduleResolution: bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noUnusedLocals`/`noUnusedParameters`. Because of `verbatimModuleSyntax`, type-only imports must use `import type`.

The CLI's `tsconfig.json` overrides the JSX pipeline: `jsx: react-jsx` with `jsxImportSource: @opentui/react`, and adds the `DOM` lib (OpenTUI's JSX types extend React's). When adding new OpenTUI element types or JSX, the CLI tsconfig — not the base — is the relevant one.

### Dependency isolation

`bunfig.toml` sets `linker = "isolated"` to prevent phantom dependencies. A package may only import deps declared in its own `package.json`; add deps to the specific app that uses them, not the root.

### Naming conventions

Source files are kebab-case (`prompt-input.tsx`), even when the default export is a PascalCase React component (`PromptInput`). In `apps/cli`, reusable UI lives in `src/components/` and full screens in `src/screens/` — keep them separate.

## Skills

`.agents/skills/` contains vendored agent skill references for the core libraries (`bun`, `hono`, `opentui`), pinned in `skills-lock.json`. Consult these (especially the OpenTUI references under `.agents/skills/opentui/references/`) when working on the relevant app — OpenTUI's component/layout API is non-obvious and documented there.
