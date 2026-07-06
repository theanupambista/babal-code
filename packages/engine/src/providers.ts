import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { getCustomConfig, listCustomModels } from "./config";
import { configFile } from "./session/paths";

/** A selectable model within a provider's curated catalog. */
export type ModelInfo = {
  id: string;
  label: string;
};

/** Sentinel model id for the /model picker “set up custom” entry. */
export const CUSTOM_SETUP_MODEL_ID = "__custom_setup__";

/** Sentinel model id for the /model picker “manage custom models” entry. */
export const MANAGE_CUSTOM_MODELS_ID = "__manage_custom__";

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
      `No API key for ${PROVIDERS[providerId].label}. Run /login to add one.`,
    );
  }
  return PROVIDERS[providerId].createModel(apiKey, modelId);
}

/**
 * All models available in the `/model` picker. Built-in provider catalogs first,
 * then every user-added custom model (each keyed by its stable entry `id` so two
 * endpoints are individually selectable), then the "set up new endpoint" action.
 */
export async function listModelOptions(): Promise<ModelOption[]> {
  const options: ModelOption[] = Object.values(PROVIDERS)
    .filter((provider) => provider.id !== "custom")
    .flatMap((provider) =>
      provider.models.map((m) => ({
        provider: provider.id as ProviderId,
        id: m.id,
        label: m.label,
        description: m.id,
        section: provider.label,
      })),
    );

  const customModels = await listCustomModels();
  for (const entry of customModels) {
    options.push({
      provider: "custom",
      id: entry.id,
      label: entry.label ?? entry.model,
      description: entry.model,
      section: "Custom",
    });
  }

  if (customModels.length > 0) {
    options.push({
      provider: "custom",
      id: MANAGE_CUSTOM_MODELS_ID,
      label: "Manage custom models",
      description: `edit · update key · delete (${customModels.length})`,
      section: "Custom",
    });
  }

  options.push({
    provider: "custom",
    id: CUSTOM_SETUP_MODEL_ID,
    label: "Add new model",
    description: "Add a new OpenAI-compatible model",
    section: "Custom",
  });

  return options;
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
