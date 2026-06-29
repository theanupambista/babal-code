import { colors } from "../theme";

/** Catch-all screen for unmatched routes. */
export function NotFound() {
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Screen not found</text>
      <text fg={colors.muted}>The requested route does not exist.</text>
    </box>
  );
}
