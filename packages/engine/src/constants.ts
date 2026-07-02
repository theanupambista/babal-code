/**
 * The default model label, re-exported from the provider registry so there is a
 * single source of truth. The session store uses it as a summary label; the live
 * model is resolved per turn from config in `agent.ts`.
 */
export { DEFAULT_MODEL as MODEL_ID } from "./providers";
