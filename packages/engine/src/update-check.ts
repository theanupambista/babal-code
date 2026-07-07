import { getUpdateCheckCache, setUpdateCheckCache } from "./config";

const NPM_PACKAGE = "@babalcode/cli";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  installCommand: string;
};

function isUpdateCheckDisabled(): boolean {
  const flag = process.env.BABALCODE_NO_UPDATE_CHECK?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `latest` is strictly newer than `current` (semver major.minor.patch). */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]!;
  }
  return false;
}

async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(NPM_PACKAGE)}/latest`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    const version = data.version?.trim();
    return version || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check npm for a newer `@babalcode/cli` release. Skips dev builds, invalid
 * versions, opt-out env, and re-checks at most once per 24 hours. Network
 * failures are silent.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  if (isUpdateCheckDisabled()) return null;
  if (!parseVersion(currentVersion)) return null;

  const now = Date.now();
  const cache = await getUpdateCheckCache();
  if (cache.lastCheckAt !== undefined && now - cache.lastCheckAt < CHECK_INTERVAL_MS) {
    const cachedLatest = cache.latestVersion;
    if (cachedLatest && isNewerVersion(cachedLatest, currentVersion)) {
      return {
        currentVersion,
        latestVersion: cachedLatest,
        installCommand: `npm install -g ${NPM_PACKAGE}@latest`,
      };
    }
    return null;
  }

  const latestVersion = await fetchLatestVersion();
  await setUpdateCheckCache({ lastCheckAt: now, latestVersion: latestVersion ?? undefined });

  if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return null;

  return {
    currentVersion,
    latestVersion,
    installCommand: `npm install -g ${NPM_PACKAGE}@latest`,
  };
}
