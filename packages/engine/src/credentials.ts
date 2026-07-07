import { Entry } from "@napi-rs/keyring";
import { isCustomReady } from "./config";
import { PROVIDERS, type ProviderId } from "./providers";

/**
 * Per-provider API keys live in the OS keychain (Windows Credential Manager /
 * macOS Keychain / libsecret) via `@napi-rs/keyring`, never in the session JSONL
 * or a plaintext file. Service is fixed; the account is the provider id, so keys
 * are namespaced per provider.
 *
 * Every keyring call is wrapped: on a machine with no keychain backend (CI,
 * headless Linux without libsecret) the native calls throw, and we degrade to the
 * environment variable instead of crashing the app.
 */
const SERVICE = "babalcode";

/** Store (or overwrite) a provider's key in the OS keychain. */
export function setApiKey(provider: ProviderId, key: string): void {
  new Entry(SERVICE, provider).setPassword(key);
}

/** The keychain-stored key for a provider, or `null` if none / no backend. */
export function getStoredApiKey(provider: ProviderId): string | null {
  try {
    return new Entry(SERVICE, provider).getPassword();
  } catch {
    return null;
  }
}

/** Remove a provider's key from the keychain; no-op if absent. */
export function deleteApiKey(provider: ProviderId): void {
  try {
    new Entry(SERVICE, provider).deletePassword();
  } catch {
    // Nothing stored, or no backend — nothing to delete.
  }
}

/**
 * Custom models each have their own key, namespaced by the model's stable entry id
 * (account `custom:<id>`) so multiple OpenAI-compatible endpoints don't share one
 * secret. Same keychain, same degrade-to-env behaviour as the provider keys above.
 */
function customModelAccount(id: string): string {
  return `custom:${id}`;
}

/** Store (or overwrite) a custom model's key in the OS keychain. */
export function setCustomModelKey(id: string, key: string): void {
  new Entry(SERVICE, customModelAccount(id)).setPassword(key);
}

/** The keychain-stored key for a custom model, or `null` if none / no backend. */
export function getCustomModelKey(id: string): string | null {
  try {
    return new Entry(SERVICE, customModelAccount(id)).getPassword();
  } catch {
    return null;
  }
}

/** Remove a custom model's key from the keychain; no-op if absent. */
export function deleteCustomModelKey(id: string): void {
  try {
    new Entry(SERVICE, customModelAccount(id)).deletePassword();
  } catch {
    // Nothing stored, or no backend — nothing to delete.
  }
}

/**
 * Resolve a custom model's key with the same precedence as providers: the shared
 * `CUSTOM_API_KEY` env override → the model's keychain entry → not set (`null`).
 */
export function resolveCustomModelKey(id: string): string | null {
  const fromEnv = process.env[PROVIDERS.custom.envVar];
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return getCustomModelKey(id);
}

/** Whether a usable key exists for a custom model (env or keychain). */
export function hasCustomModelKey(id: string): boolean {
  return resolveCustomModelKey(id) !== null;
}

/**
 * Resolve the effective key with the industry-standard precedence:
 * environment variable override → keychain → not set (`null`). The env var wins so
 * CI and scripted runs can force a key without touching the keychain.
 */
export function resolveApiKey(provider: ProviderId): string | null {
  const fromEnv = process.env[PROVIDERS[provider].envVar];
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return getStoredApiKey(provider);
}

/** Whether a usable key exists for the provider (env or keychain). */
export function hasApiKey(provider: ProviderId): boolean {
  return resolveApiKey(provider) !== null;
}

/** Whether the custom provider can run (configured baseURL, key optional). */
export async function hasCustomAuth(): Promise<boolean> {
  if (resolveApiKey("custom")) return true;
  return isCustomReady();
}

/** Whether a usable key exists for the provider, or custom is configured without a key. */
export async function hasProviderAuth(provider: ProviderId): Promise<boolean> {
  if (provider === "custom") return hasCustomAuth();
  return hasApiKey(provider);
}
