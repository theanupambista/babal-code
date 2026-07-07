/**
 * `@babalcode/engine` — the headless coding agent. It owns the tools, the agent
 * loop, the workspace guardrail, and on-disk session history. It has no UI and no
 * HTTP layer: the CLI imports and drives it in-process.
 */
export { runAgent } from "./agent";
export { clearReadTracker } from "./read-tracker";
export { loadMessages, listSessions, type SessionSummary } from "./session/store";
export { WORKSPACE_ROOT } from "./workspace";
export { listWorkspaceFiles } from "./tools/glob";
export { MODEL_ID } from "./constants";
export {
  PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  resolveLanguageModel,
  getModelDisplayLabel,
  type ProviderId,
  type ProviderInfo,
  type ModelInfo,
  type ModelOption,
} from "./providers";
export {
  getModelSelection,
  isSelectionAvailable,
  listConnectedModelOptions,
  listProviderConnections,
  hasStoredProviderKey,
  type ProviderConnection,
} from "./model-catalog";
export {
  readModelSelection,
  clearModelSelection,
  clearModelSelectionForProvider,
  setModelSelection,
  selectCustomModel,
  getSelectedCustomModel,
  getCustomConfig,
  isCustomReady,
  setCustomProvider,
  listCustomModels,
  getCustomModel,
  addCustomModel,
  updateCustomModel,
  deleteCustomModel,
  type CustomModel,
  type CustomConfig,
  type ModelSelection,
} from "./config";
export { configFile } from "./session/paths";
export {
  MODES,
  DEFAULT_MODE_ID,
  getMode,
  getNextModeId,
  isModeId,
  type Mode,
  type ModeId,
} from "./modes";
export {
  setApiKey,
  deleteApiKey,
  resolveApiKey,
  getStoredApiKey,
  hasApiKey,
  hasProviderAuth,
  setCustomModelKey,
  getCustomModelKey,
  deleteCustomModelKey,
  resolveCustomModelKey,
  hasCustomModelKey,
} from "./credentials";
export {
  permission,
  PermissionDeniedError,
  PermissionRejectedError,
  type PermissionService,
  type PendingPermission,
  type PermissionAction,
  type PermissionDecision,
  type PermissionRequest,
  type PermissionConfig,
} from "./permission";
