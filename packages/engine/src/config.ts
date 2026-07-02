import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, type ProviderId } from "./providers";
import { BABALCODE_DIR, configFile } from "./session/paths";

/**
 * Global (not per-session) preferences persisted as a single JSON blob at
 * `~/.babalcode/config.json` — currently just the default provider + model chosen
 * via `/model`. Kept separate from session history and from credentials (which live
 * in the keychain). Missing / corrupt file is treated as "no preferences yet".
 */
type Config = {
  provider?: ProviderId;
  model?: string;
};

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configFile(), "utf8")) as Config;
  } catch {
    return {};
  }
}

/** The chosen provider + model, falling back to the built-in defaults. */
export async function getModelSelection(): Promise<{ provider: ProviderId; model: string }> {
  const config = await readConfig();
  return {
    provider: config.provider ?? DEFAULT_PROVIDER,
    model: config.model ?? DEFAULT_MODEL,
  };
}

/** Persist the chosen provider + model, merging over any existing config. */
export async function setModelSelection(provider: ProviderId, model: string): Promise<void> {
  const next: Config = { ...(await readConfig()), provider, model };
  await mkdir(BABALCODE_DIR, { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}
