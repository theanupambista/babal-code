import {
  clearModelSelection,
  getCustomModel,
  listCustomModels,
  readModelSelection,
  type ModelSelection,
} from "./config";
import { hasProviderAuth, resolveApiKey } from "./credentials";
import { PROVIDERS, type ModelOption, type ProviderId } from "./providers";

/** Whether a persisted selection still refers to a connected provider / existing custom model. */
export async function isSelectionAvailable(selection: ModelSelection): Promise<boolean> {
  if (selection.provider === "custom") {
    if (!selection.customModelId) return false;
    return (await getCustomModel(selection.customModelId)) !== null;
  }
  return hasProviderAuth(selection.provider);
}

/**
 * The active model choice, or `null` when unset or no longer available (e.g. the
 * provider key was removed). Stale config is cleared automatically.
 */
export async function getModelSelection(): Promise<ModelSelection | null> {
  const selection = await readModelSelection();
  if (!selection) return null;
  if (!(await isSelectionAvailable(selection))) {
    await clearModelSelection();
    return null;
  }
  return selection;
}

/** Connection status for a built-in provider, shown in `/connect`. */
export type ProviderConnection = {
  id: ProviderId;
  label: string;
  envVar: string;
  connected: boolean;
  /** Auth is satisfied by an environment variable override (not the keychain). */
  fromEnv: boolean;
  modelCount: number;
};

const BUILT_IN_PROVIDER_IDS = (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => id !== "custom");

/** Every built-in provider and whether it currently has usable credentials. */
export async function listProviderConnections(): Promise<ProviderConnection[]> {
  const connections: ProviderConnection[] = [];
  for (const id of BUILT_IN_PROVIDER_IDS) {
    const info = PROVIDERS[id];
    const fromEnv = Boolean(process.env[info.envVar]?.trim());
    connections.push({
      id,
      label: info.label,
      envVar: info.envVar,
      connected: await hasProviderAuth(id),
      fromEnv,
      modelCount: info.models.length,
    });
  }
  return connections;
}

/**
 * Models available in `/models` — only from providers the user has connected.
 * Built-in models require a resolved API key; custom models appear once added.
 */
export async function listConnectedModelOptions(): Promise<ModelOption[]> {
  const options: ModelOption[] = [];

  for (const id of BUILT_IN_PROVIDER_IDS) {
    if (!(await hasProviderAuth(id))) continue;
    const provider = PROVIDERS[id];
    for (const m of provider.models) {
      options.push({
        provider: id,
        id: m.id,
        label: m.label,
        description: m.id,
        section: provider.label,
      });
    }
  }

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

  return options;
}

/** Whether a built-in provider's key is stored in the keychain (not env). */
export function hasStoredProviderKey(provider: ProviderId): boolean {
  if (provider === "custom") return false;
  const fromEnv = Boolean(process.env[PROVIDERS[provider].envVar]?.trim());
  if (fromEnv) return false;
  return resolveApiKey(provider) !== null;
}
