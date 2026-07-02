import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/** A selectable model within a provider's curated catalog. */
export type ModelInfo = {
  id: string;
  label: string;
};

/**
 * A model provider: how to name it, which env var holds its key (for the
 * env-override path in `credentials.ts`), its curated model catalog, and how to
 * build a language model from a resolved key. Keeping providers behind this shape
 * means adding one (Anthropic, OpenAI, …) is a single entry here plus its `@ai-sdk/*`
 * dependency — nothing else in the engine hard-codes a provider.
 */
export type ProviderInfo = {
  id: string;
  label: string;
  /** Env var the SDK conventionally reads; also our env-override key source. */
  envVar: string;
  models: readonly ModelInfo[];
  createModel: (apiKey: string, modelId: string) => LanguageModel;
};

export const PROVIDERS = {
  google: {
    id: "google",
    label: "Google Gemini",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    createModel: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
  },
} satisfies Record<string, ProviderInfo>;

export type ProviderId = keyof typeof PROVIDERS;

/** The provider used when config has no explicit choice. */
export const DEFAULT_PROVIDER: ProviderId = "google";

/** The model used when config has no explicit choice. */
export const DEFAULT_MODEL = "gemini-2.5-flash";
