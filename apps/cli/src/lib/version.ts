declare const BABALCODE_VERSION: string | undefined;

/** Installed release version, or `"dev"` when running from source. */
export function getAppVersion(): string {
  return typeof BABALCODE_VERSION === "string" ? BABALCODE_VERSION : "dev";
}
