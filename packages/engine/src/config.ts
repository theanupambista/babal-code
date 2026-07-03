import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, type ProviderId } from "./providers";
import { BABALCODE_DIR, configFile } from "./session/paths";

/** OpenAI-compatible endpoint settings from `~/.babalcode/config.json`. */
export type CustomConfig = {
  baseURL: string;
  label?: string;
  modelLabel?: string;
};

/**
 * Global (not per-session) preferences persisted as a single JSON blob at
 * `~/.babalcode/config.json` — currently just the default provider + model chosen
 * via `/model`. Kept separate from session history and from credentials (which live
 * in the keychain). Missing / corrupt file is treated as "no preferences yet".
 */
type Config = {
  provider?: ProviderId;
  model?: string;
  custom?: CustomConfig;
};

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configFile(), "utf8")) as Config;
  } catch {
    return {};
  }
}

/** Normalize a custom block; returns null when baseURL is missing or blank. */
export async function getCustomConfig(): Promise<CustomConfig | null> {
  const config = await readConfig();
  const baseURL = config.custom?.baseURL?.trim();
  if (!baseURL) return null;
  return {
    baseURL: baseURL.replace(/\/+$/, ""),
    label: config.custom?.label,
    modelLabel: config.custom?.modelLabel,
  };
}

/** Whether the custom provider has enough config to run without an API key. */
export async function isCustomReady(): Promise<boolean> {
  return (await getCustomConfig()) !== null;
}

/** The chosen provider + model, falling back to the built-in defaults. */
export async function getModelSelection(): Promise<{ provider: ProviderId; model: string }> {
  const config = await readConfig();
  return {
    provider: config.provider ?? DEFAULT_PROVIDER,
    model: config.model ?? DEFAULT_MODEL,
  };
}

/** Persist custom provider settings and activate it as the default model. */
export async function setCustomProvider(options: {
  baseURL: string;
  model: string;
  label?: string;
  modelLabel?: string;
}): Promise<void> {
  const baseURL = options.baseURL.trim().replace(/\/+$/, "");
  const next: Config = {
    ...(await readConfig()),
    provider: "custom",
    model: options.model.trim(),
    custom: {
      baseURL,
      label: options.label,
      modelLabel: options.modelLabel,
    },
  };
  await mkdir(BABALCODE_DIR, { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function setModelSelection(provider: ProviderId, model: string): Promise<void> {
  const next: Config = { ...(await readConfig()), provider, model };
  await mkdir(BABALCODE_DIR, { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}
