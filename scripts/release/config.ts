/** npm platform suffix, e.g. `darwin-arm64` → `@babalcode/cli-darwin-arm64`. */
export type PlatformId =
  | "darwin-arm64"
  | "darwin-x64"
  | "linux-arm64"
  | "linux-x64"
  | "win32-x64";

export type PlatformConfig = {
  id: PlatformId;
  /** Bun cross-compile target passed to `bun build --compile`. */
  bunTarget: `bun-${PlatformId}`;
  os: string[];
  cpu: string[];
  /** Compiled CLI filename inside the platform package `bin/` directory. */
  cliBinary: string;
  /** Ripgrep filename copied beside the CLI binary. */
  rgBinary: string;
  /** GitHub Actions `runs-on` label for native builds. */
  runner: string;
  /** Windows-only: hide the extra console window spawned by the executable. */
  windowsHideConsole?: boolean;
};

export const PLATFORMS: readonly PlatformConfig[] = [
  {
    id: "darwin-arm64",
    bunTarget: "bun-darwin-arm64",
    os: ["darwin"],
    cpu: ["arm64"],
    cliBinary: "babalcode",
    rgBinary: "rg",
    runner: "macos-latest",
  },
  {
    id: "darwin-x64",
    bunTarget: "bun-darwin-x64",
    os: ["darwin"],
    cpu: ["x64"],
    cliBinary: "babalcode",
    rgBinary: "rg",
    runner: "macos-latest",
  },
  {
    id: "linux-arm64",
    bunTarget: "bun-linux-arm64",
    os: ["linux"],
    cpu: ["arm64"],
    cliBinary: "babalcode",
    rgBinary: "rg",
    runner: "ubuntu-24.04-arm",
  },
  {
    id: "linux-x64",
    bunTarget: "bun-linux-x64",
    os: ["linux"],
    cpu: ["x64"],
    cliBinary: "babalcode",
    rgBinary: "rg",
    runner: "ubuntu-latest",
  },
  {
    id: "win32-x64",
    bunTarget: "bun-win32-x64",
    os: ["win32"],
    cpu: ["x64"],
    cliBinary: "babalcode.exe",
    rgBinary: "rg.exe",
    runner: "windows-latest",
    windowsHideConsole: true,
  },
] as const;

export const ENTRYPOINT = "apps/cli/src/index.tsx";
export const WRAPPER_PACKAGE = "@babalcode/cli";

export function platformPackageName(id: PlatformId): string {
  return `${WRAPPER_PACKAGE}-${id}`;
}

export function opentuiPlatformPackage(id: PlatformId): string {
  return `@opentui/core-${id}`;
}

export function ripgrepPlatformPackage(id: PlatformId): string {
  return `@vscode/ripgrep-${id}`;
}

/** Read release version from RELEASE_VERSION env or release/VERSION file. */
export async function readReleaseVersion(): Promise<string> {
  if (process.env.RELEASE_VERSION) return process.env.RELEASE_VERSION;

  const versionFile = new URL("../../release/VERSION", import.meta.url);
  const text = await Bun.file(versionFile).text();
  const version = text.trim();
  if (!version) throw new Error("release/VERSION is empty");
  return version;
}

export function getPlatform(id: string): PlatformConfig {
  const platform = PLATFORMS.find((p) => p.id === id);
  if (!platform) {
    throw new Error(
      `Unknown platform "${id}". Expected one of: ${PLATFORMS.map((p) => p.id).join(", ")}`,
    );
  }
  return platform;
}
