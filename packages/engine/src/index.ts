/**
 * `@babalcode/engine` — the headless coding agent. It owns the tools, the agent
 * loop, the workspace guardrail, and on-disk session history. It has no UI and no
 * HTTP layer: the CLI imports and drives it in-process.
 */
export { runAgent } from "./agent";
export { loadMessages, listSessions, type SessionSummary } from "./session/store";
export { WORKSPACE_ROOT } from "./workspace";
export { MODEL_ID } from "./constants";
export {
  PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  type ProviderId,
  type ProviderInfo,
  type ModelInfo,
} from "./providers";
export { getModelSelection, setModelSelection } from "./config";
export {
  MODES,
  DEFAULT_MODE_ID,
  getMode,
  getNextModeId,
  isModeId,
  type Mode,
  type ModeId,
} from "./modes";
export { setApiKey, deleteApiKey, resolveApiKey, getStoredApiKey, hasApiKey } from "./credentials";
