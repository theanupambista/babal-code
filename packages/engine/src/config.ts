import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { type ProviderId } from "./providers";
import { BABALCODE_DIR, configFile } from "./session/paths";

/**
 * A user-added OpenAI-compatible model. Unlike the old single-endpoint design, any
 * number of these can be stored — the user adds as many as they want. Each entry is
 * independently selectable and carries its own endpoint; its `id` is the stable handle
 * used to select, edit, and delete it (and, later, to namespace its API key).
 */
export type CustomModel = {
  id: string;
  /** OpenAI-compatible base URL (usually ends with /v1). */
  baseURL: string;
  /** Model id sent to the API (e.g. "llama3.2"). */
  model: string;
  /** Display name for the model in the picker; falls back to `model`. */
  label?: string;
  /** Display name for the endpoint/provider; falls back to the custom provider label. */
  providerLabel?: string;
};

/** OpenAI-compatible endpoint settings, as consumed by the provider resolver. */
export type CustomConfig = {
  baseURL: string;
  label?: string;
  modelLabel?: string;
};

/**
 * Global (not per-session) preferences persisted as a single JSON blob at
 * `~/.babalcode/config.json`: the default provider + model chosen via `/models`, plus
 * the list of user-added custom models. Kept separate from session history and from
 * credentials (which live in the keychain). Missing / corrupt file is treated as "no
 * preferences yet".
 */
type Config = {
  provider?: ProviderId;
  /** For built-in providers, the model id. For custom, the selected model's api id. */
  model?: string;
  /** When custom is selected, the `id` of the chosen `CustomModel` (disambiguates
   * two entries that share an api model id but differ by endpoint). */
  customModelId?: string;
  /** Every OpenAI-compatible model the user has added. */
  customModels?: CustomModel[];
  /** Unix ms when the npm update check last ran. */
  lastUpdateCheckAt?: number;
  /** Latest `@babalcode/cli` version returned by the most recent check. */
  cachedLatestVersion?: string;
};

export type UpdateCheckCache = {
  lastCheckAt?: number;
  latestVersion?: string;
};

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configFile(), "utf8")) as Config;
  } catch {
    return {};
  }
}

async function writeConfig(config: Config): Promise<void> {
  await mkdir(BABALCODE_DIR, { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/** Trim trailing slashes so baseURLs compare and print consistently. */
function normalizeBaseURL(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

// ── Update check cache ──────────────────────────────────────────────────────

/** Cached npm update-check state from `config.json`. */
export async function getUpdateCheckCache(): Promise<UpdateCheckCache> {
  const config = await readConfig();
  return {
    lastCheckAt: config.lastUpdateCheckAt,
    latestVersion: config.cachedLatestVersion,
  };
}

/** Persist npm update-check results for the 24h throttle. */
export async function setUpdateCheckCache(cache: UpdateCheckCache): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    lastUpdateCheckAt: cache.lastCheckAt,
    cachedLatestVersion: cache.latestVersion,
  });
}

// ── Custom model CRUD ───────────────────────────────────────────────────────

/** Every custom model the user has added, in insertion order. */
export async function listCustomModels(): Promise<CustomModel[]> {
  const { customModels } = await readConfig();
  return customModels ?? [];
}

/** A single custom model by its stable id, or `null` if absent. */
export async function getCustomModel(id: string): Promise<CustomModel | null> {
  const models = await listCustomModels();
  return models.find((m) => m.id === id) ?? null;
}

/** Append a new custom model and return the stored entry (with its generated id). */
export async function addCustomModel(input: {
  baseURL: string;
  model: string;
  label?: string;
  providerLabel?: string;
}): Promise<CustomModel> {
  const entry: CustomModel = {
    id: randomUUID(),
    baseURL: normalizeBaseURL(input.baseURL),
    model: input.model.trim(),
    label: input.label?.trim() || undefined,
    providerLabel: input.providerLabel?.trim() || undefined,
  };
  const config = await readConfig();
  await writeConfig({ ...config, customModels: [...(config.customModels ?? []), entry] });
  return entry;
}

/** Patch an existing custom model in place; unknown ids are a no-op. */
export async function updateCustomModel(
  id: string,
  patch: Partial<Omit<CustomModel, "id">>,
): Promise<void> {
  const config = await readConfig();
  const models = config.customModels ?? [];
  const next = models.map((m) =>
    m.id === id
      ? {
          ...m,
          ...patch,
          baseURL: patch.baseURL !== undefined ? normalizeBaseURL(patch.baseURL) : m.baseURL,
          model: patch.model !== undefined ? patch.model.trim() : m.model,
        }
      : m,
  );
  await writeConfig({ ...config, customModels: next });
}

/**
 * Remove a custom model. If it was the active selection, clear the selection
 * entirely (no model selected) rather than silently jumping to a built-in default —
 * the user picks the next model explicitly. The agent never points at a deleted
 * endpoint because the selection is now empty.
 */
export async function deleteCustomModel(id: string): Promise<void> {
  const config = await readConfig();
  const next: Config = {
    ...config,
    customModels: (config.customModels ?? []).filter((m) => m.id !== id),
  };
  if (config.provider === "custom" && config.customModelId === id) {
    next.provider = undefined;
    next.model = undefined;
    next.customModelId = undefined;
  }
  await writeConfig(next);
}

// ── Selection ───────────────────────────────────────────────────────────────

/** A resolved model choice: a built-in provider + model, or a custom entry by id. */
export type ModelSelection = {
  provider: ProviderId;
  model: string;
  customModelId?: string;
};

/**
 * The raw persisted selection from config, without checking whether the provider
 * is still connected. Prefer `getModelSelection()` from `model-catalog.ts`, which
 * validates and clears stale entries.
 */
export async function readModelSelection(): Promise<ModelSelection | null> {
  const config = await readConfig();
  if (!config.provider || !config.model) return null;
  return {
    provider: config.provider,
    model: config.model,
    customModelId: config.customModelId,
  };
}

/** Clear the active model selection (e.g. when its provider is disconnected). */
export async function clearModelSelection(): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    provider: undefined,
    model: undefined,
    customModelId: undefined,
  });
}

/** Clear the selection when it points at a provider that was just disconnected. */
export async function clearModelSelectionForProvider(provider: ProviderId): Promise<void> {
  const config = await readConfig();
  if (config.provider !== provider) return;
  await clearModelSelection();
}

/** Persist a built-in provider + model chosen via the picker (clears custom selection). */
export async function setModelSelection(provider: ProviderId, model: string): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, provider, model, customModelId: undefined });
}

/** Select a custom model by its stable id; no-op if the id is unknown. */
export async function selectCustomModel(id: string): Promise<void> {
  const config = await readConfig();
  const entry = (config.customModels ?? []).find((m) => m.id === id);
  if (!entry) return;
  await writeConfig({ ...config, provider: "custom", model: entry.model, customModelId: id });
}

/** The currently-selected custom model entry, or `null` if custom isn't active. */
export async function getSelectedCustomModel(): Promise<CustomModel | null> {
  const config = await readConfig();
  if (config.provider !== "custom") return null;
  const models = config.customModels ?? [];
  if (config.customModelId) return models.find((m) => m.id === config.customModelId) ?? null;
  return models.find((m) => m.model === config.model) ?? null;
}

// ── Compatibility helpers for the current resolver / UI ─────────────────────
// These bridge the multi-model store to the single-endpoint call sites in
// `providers.ts`, `credentials.ts`, and the `/custom` setup screen. They will be
// superseded once the picker and management UI are updated to address models by id.

/** The endpoint of the currently-selected custom model, or `null` if not custom. */
export async function getCustomConfig(): Promise<CustomConfig | null> {
  const entry = await getSelectedCustomModel();
  if (!entry) return null;
  return {
    baseURL: entry.baseURL,
    label: entry.providerLabel,
    modelLabel: entry.label,
  };
}

/** Whether at least one custom model has been configured. */
export async function isCustomReady(): Promise<boolean> {
  return (await listCustomModels()).length > 0;
}

/**
 * Add-or-update a custom model (deduped by baseURL + model) and select it as the
 * active model. Used by the `/custom` setup screen; appends rather than overwriting,
 * so setting up a second endpoint no longer clobbers the first.
 */
export async function setCustomProvider(options: {
  baseURL: string;
  model: string;
  label?: string;
  modelLabel?: string;
}): Promise<void> {
  const baseURL = normalizeBaseURL(options.baseURL);
  const model = options.model.trim();
  const config = await readConfig();
  const models = config.customModels ?? [];
  const existing = models.find((m) => m.baseURL === baseURL && m.model === model);

  let nextModels: CustomModel[];
  let selectedId: string;
  if (existing) {
    selectedId = existing.id;
    nextModels = models.map((m) =>
      m === existing
        ? { ...m, label: options.modelLabel ?? m.label, providerLabel: options.label ?? m.providerLabel }
        : m,
    );
  } else {
    selectedId = randomUUID();
    nextModels = [
      ...models,
      { id: selectedId, baseURL, model, label: options.modelLabel, providerLabel: options.label },
    ];
  }

  await writeConfig({ ...config, provider: "custom", model, customModelId: selectedId, customModels: nextModels });
}
