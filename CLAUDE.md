# CLAUDE.md

This file provides guidance to agents when working with code in this repository.

## Runtime

This is a **Bun**-first project. Use `bun` for everything (running, installing, scripts) — not `node`, `npm`, `pnpm`, or `ts-node`. TypeScript and TSX run directly under Bun with no build/transpile step; there is no `dist/` output during development.

## Commands

Run from the repo root:

- `bun install` — install all workspace dependencies
- `bun run dev` — run the CLI with file watching (this is the whole app)
- `bun run start` — run the CLI without watching
- `bun run typecheck` — `tsc --noEmit` across every workspace (the only check that exists; there is no lint config and no test setup yet)

`bun run dev`/`start` intentionally launch the CLI **by path, without `--cwd`**, so `process.cwd()` stays the directory you invoke them from — that cwd *is* the agent's workspace root (see the engine's `workspace.ts`).

The CLI is also exposed as a `babalcode` bin (`apps/cli/package.json`). It reads the model key from `GOOGLE_GENERATIVE_AI_API_KEY` at startup (bring-your-own-key) and exits if unset.

## Architecture

Bun-workspace monorepo. Members are globbed from `apps/*` and `packages/*` (see root `package.json` `workspaces`). It is a **monolithic, single-process** coding agent — no HTTP server, no database:

- **`apps/cli`** (`@babalcode/cli`) — a terminal UI built with [OpenTUI](https://github.com/sst/opentui) + React 19, and the single process. It drives the agent **in-process** via a custom `ChatTransport` (`src/lib/transport.ts`) that calls the engine directly; `useChat` streams from it with no network hop.
- **`packages/engine`** (`@babalcode/engine`) — the headless agent: the coding tools + workspace guardrail (`src/tools/`, `src/workspace.ts`), the `streamText` loop (`src/agent.ts` → `runAgent`), and Claude-Code-style JSONL session history under `~/.babalcode/projects/<hash>/` (`src/session/`). No UI, no HTTP. Add a tool by dropping `src/tools/<name>.ts` and adding one line to `src/tools/index.ts`.

### TypeScript config

All apps extend `tsconfig.base.json`, which sets Bun-oriented strict options: `moduleResolution: bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noUnusedLocals`/`noUnusedParameters`. Because of `verbatimModuleSyntax`, type-only imports must use `import type`.

The CLI's `tsconfig.json` overrides the JSX pipeline: `jsx: react-jsx` with `jsxImportSource: @opentui/react`, and adds the `DOM` lib (OpenTUI's JSX types extend React's). When adding new OpenTUI element types or JSX, the CLI tsconfig — not the base — is the relevant one.

### Dependency isolation

`bunfig.toml` sets `linker = "isolated"` to prevent phantom dependencies. A package may only import deps declared in its own `package.json`; add deps to the specific app that uses them, not the root.

### Naming conventions

Source files are kebab-case (`prompt-input.tsx`), even when the default export is a PascalCase React component (`PromptInput`). In `apps/cli`, reusable UI lives in `src/components/` and full screens in `src/screens/` — keep them separate.

## Skills

`.agents/skills/` contains vendored agent skill references for the core libraries (`bun`, `hono`, `opentui`), pinned in `skills-lock.json`. Consult these (especially the OpenTUI references under `.agents/skills/opentui/references/`) when working on the relevant app — OpenTUI's component/layout API is non-obvious and documented there.
