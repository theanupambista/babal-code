/**
 * The default model label, re-exported from the provider registry so there is a
 * single source of truth. The live model is resolved per turn from config in
 * `agent.ts`; each session records the model used on its user messages.
 */
export { DEFAULT_MODEL as MODEL_ID } from "./providers";
