import type { UpdateInfo } from "@babalcode/engine";
import { colors } from "../theme";

type UpdateBannerProps = {
  update: UpdateInfo;
};

/**
 * Non-blocking banner shown when a newer `@babalcode/cli` is on npm.
 */
export function UpdateBanner({ update }: UpdateBannerProps) {
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={colors.accent}
      paddingLeft={1}
      paddingRight={1}
      alignItems="center"
    >
      <text fg={colors.accent}>
        {`Update available: v${update.latestVersion} (you have v${update.currentVersion})`}
      </text>
      <text fg={colors.muted}>{`Run: ${update.installCommand}`}</text>
    </box>
  );
}
