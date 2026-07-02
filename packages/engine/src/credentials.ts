import { Entry } from "@napi-rs/keyring";
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
