# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime

This is a **Bun**-first project. Use `bun` for everything (running, installing, scripts) — not `node`, `npm`, `pnpm`, or `ts-node`. TypeScript and TSX run directly under Bun with no build/transpile step; there is no `dist/` output during development.

## Commands

Run from the repo root:

- `bun install` — install all workspace dependencies
- `bun run dev` — run the CLI with file watching (this is the whole app)
- `bun run start` — run the CLI without watching
- `bun run typecheck` — `tsc --noEmit` across every workspace (the only check that exists; there is no lint config and no test setup yet)
- `bun run release:*` (`build`/`prepare`/`pack`/`publish`) — the packaging pipeline in `scripts/release/`

`bun run dev`/`start` intentionally launch the CLI **by path, without `--cwd`**, so `process.cwd()` stays the directory you invoke them from — that cwd _is_ the agent's workspace root (see the engine's `workspace.ts`).

The CLI is also exposed as a `babalcode` bin (`apps/cli/package.json`).

## Model providers & keys

Multi-provider, bring-your-own-key. There is **no** hard key check at startup: the app always opens on home. If no model is selected, the prompt shows a "No model" state and blocks sending until the user connects a provider (`/connect`) or picks a model (`/models`).

- **`providers.ts`** — the `PROVIDERS` registry (Google, Anthropic, OpenAI, and a `custom` OpenAI-compatible endpoint). Each entry names its env var and curated model catalog and knows how to build a `LanguageModel` from a key. Adding a provider is one entry here plus its `@ai-sdk/*` dep — nothing else hard-codes a provider.
- **`credentials.ts`** — per-provider keys live in the **OS keychain** (`@napi-rs/keyring`), never in JSONL or plaintext. Resolution precedence is **env var → keychain → null**. Every keyring call is wrapped so a machine with no keychain backend degrades to the env var instead of crashing. Custom models keep their own keys, namespaced `custom:<id>`.
- **`config.ts` / `model-catalog.ts`** — the selected provider+model and custom-endpoint config persist to `~/.babalcode/config.json`; the catalog joins curated + custom models and filters to connected ones for the picker.

`runAgent` re-resolves provider, model, and key **per turn**, so switching any of them via slash command takes effect on the next message with no restart.

## Architecture

Bun-workspace monorepo. Members are globbed from `apps/*` and `packages/*` (see root `package.json` `workspaces`). It is a **monolithic, single-process** coding agent — no HTTP server, no database:

- **`apps/cli`** (`@babalcode/cli`) — a terminal UI built with [OpenTUI](https://github.com/sst/opentui) + React 19, and the single process. It drives the agent **in-process** via `InProcessTransport` (`src/lib/transport.ts`), a `ChatTransport` whose `sendMessages` calls the engine's `runAgent` directly; `useChat` streams from it with no network hop.
- **`packages/engine`** (`@babalcode/engine`) — the headless agent. No UI, no HTTP; the CLI imports and drives it. Its public surface is `src/index.ts`.

### Engine internals

- **`agent.ts` → `runAgent`** — one agent turn. Resolves model+key and the active mode, builds the system prompt, filters the toolset to the mode's allowlist, then runs `streamText` with `stopWhen: stepCountIs(25)` (a coding turn chains many tool calls). Returns a UI message stream (`toUIMessageStream`, `sendReasoning: true`). Persists the user message up front and the assistant/error on finish.
- **`tools/`** — the coding tools (`readFile`, `writeFile`, `editFile`, `listDirectory`, `grep`, `glob`, `bash`). Registered in `tools/index.ts` as `codingTools`; each key becomes the `tool-<name>` UI part the CLI renders. **Add a tool** by dropping `tools/<name>.ts` and adding one line to `tools/index.ts` — `agent.ts` does not change.
- **`workspace.ts`** — the guardrail: `WORKSPACE_ROOT` is `process.cwd()`, and tools resolve/confine paths under it.
- **`permission/`** — a capability-based approval broker. Side-effecting tools `await permission` before acting; the CLI renders the pending prompt. Decisions ("always allow/deny") persist **per workspace** to `<projectDir>/permissions.json`.
- **`modes.ts`** — named behavioural profiles (`build`, `plan`). A mode injects extra system instructions, restricts the toolset (`"all"` or an allowlist), and can `autoAllow` safe mutations (Build auto-allows `writeFile`/`editFile`; `bash` still prompts). Tab cycles modes. Add one by appending to `MODES` and widening `ModeId`.
- **`prompts/`** — the system prompt is composed from ordered `sections/` (identity, tone, using-tools, …) via `builder.ts`; `getSystemPrompt(ctx)` joins them, receiving the enabled-tool set so prompt text matches the active mode.
- **`session/`** — Claude-Code-style append-only JSONL history under `~/.babalcode/projects/<hash>/`, where `<hash>` is a stable hash of the absolute workspace root (see `session/paths.ts`), so projects never share history. History is deduped by message id on read.

### CLI internals

- **`main.tsx`** — boots the OpenTUI renderer with `exitOnCtrlC: false`, wraps the app in `LayerProvider`, and renders a `react-router` memory router (`router.tsx`, `routes.ts`).
- **`screens/`** — full screens (`home`, `chat`, `not-found`); **`components/`** — reusable UI (the `chat/` and `dialog/` subtrees, inputs, etc.). Keep the two separate.
- **`commands.ts`** — the slash-command registry for prompt autocomplete. A bare `/token` either navigates to a route or dispatches an action (`/clear`, `/exit`, `/models`, `/connect`, `/custom`, `/sessions`).
- **`services/layer/`** — keyboard/focus/z-order stack. Route Ctrl+C and key handling through the layer service (`useLayerKeyboard`/`useIsActiveLayer`/`<Layer>`), **not** raw `useKeyboard`.

### TypeScript config

All apps extend `tsconfig.base.json`, which sets Bun-oriented strict options: `moduleResolution: bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noUnusedLocals`/`noUnusedParameters`. Because of `verbatimModuleSyntax`, type-only imports must use `import type`.

The CLI's `tsconfig.json` overrides the JSX pipeline: `jsx: react-jsx` with `jsxImportSource: @opentui/react`, and adds the `DOM` lib (OpenTUI's JSX types extend React's). When adding new OpenTUI element types or JSX, the CLI tsconfig — not the base — is the relevant one.

### Dependency isolation

`bunfig.toml` sets `linker = "isolated"` to prevent phantom dependencies. A package may only import deps declared in its own `package.json`; add deps to the specific app that uses them, not the root.

### Naming conventions

Source files are kebab-case (`prompt-input.tsx`), even when the default export is a PascalCase React component (`PromptInput`).

## Skills

`.agents/skills/` contains vendored agent skill references for the core libraries, pinned in `skills-lock.json`. The present references are **`opentui`** and **`ai-sdk`** (Vercel AI SDK). Consult them when working on the relevant area — OpenTUI's component/layout API and the AI SDK's `streamText`/UI-message-stream shapes are non-obvious and documented there (OpenTUI details under `.agents/skills/opentui/references/`).
