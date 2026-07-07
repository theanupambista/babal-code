import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getCustomConfig } from "./config";
import { configFile } from "./session/paths";

/** A selectable model within a provider's curated catalog. */
export type ModelInfo = {
  id: string;
  label: string;
};

export type ModelOption = {
  provider: ProviderId;
  id: string;
  label: string;
  /** Secondary line shown under the label in the picker. */
  description?: string;
  /** Section heading the picker groups this option under (e.g. "Custom"). */
  section?: string;
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
  /** When false, the agent may run without a resolved API key (e.g. local Ollama). */
  requiresApiKey?: boolean;
  createModel: (apiKey: string, modelId: string) => LanguageModel;
};

export const PROVIDERS = {
  google: {
    id: "google",
    label: "Google Gemini",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    requiresApiKey: true,
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    createModel: (apiKey, modelId) =>
      createGoogleGenerativeAI({ apiKey })(modelId),
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    envVar: "ANTHROPIC_API_KEY",
    requiresApiKey: true,
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
    createModel: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    requiresApiKey: true,
    models: [
      { id: "gpt-5.1", label: "GPT-5.1" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
    ],
    createModel: (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    envVar: "CUSTOM_API_KEY",
    models: [],
    requiresApiKey: false,
    createModel: () => {
      throw new Error("Use resolveLanguageModel() for the custom provider");
    },
  },
} satisfies Record<string, ProviderInfo>;

export type ProviderId = keyof typeof PROVIDERS;

/** The provider used when config has no explicit choice. */
export const DEFAULT_PROVIDER: ProviderId = "google";

/** The model used when config has no explicit choice. */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/** Resolve a language model for the given provider, model id, and optional key. */
export async function resolveLanguageModel(
  providerId: ProviderId,
  modelId: string,
  apiKey: string | null,
): Promise<LanguageModel> {
  if (providerId === "custom") {
    const custom = await getCustomConfig();
    if (!custom) {
      throw new Error(
        `Custom provider requires custom.baseURL in ${configFile()}. Example:\n` +
          `{\n  "provider": "custom",\n  "model": "llama3.2",\n` +
          `  "custom": { "baseURL": "http://localhost:11434/v1" }\n}`,
      );
    }
    return createOpenAICompatible({
      name: "custom",
      baseURL: custom.baseURL,
      apiKey: apiKey ?? "no-key",
    })(modelId);
  }

  if (!apiKey) {
    throw new Error(
      `No API key for ${PROVIDERS[providerId].label}. Open /connect to add one.`,
    );
  }
  return PROVIDERS[providerId].createModel(apiKey, modelId);
}

/**
 * Model + provider text for the chat footer. Always shows the raw model id (not a
 * friendly label) so the footer reflects exactly what's sent to the API.
 */
export async function getModelDisplayLabel(
  providerId: ProviderId,
  modelId: string,
): Promise<{ modelLabel: string; providerLabel: string }> {
  if (providerId === "custom") {
    const custom = await getCustomConfig();
    return {
      modelLabel: modelId,
      providerLabel: custom?.label ?? PROVIDERS.custom.label,
    };
  }

  return {
    modelLabel: modelId,
    providerLabel: PROVIDERS[providerId].label,
  };
}
