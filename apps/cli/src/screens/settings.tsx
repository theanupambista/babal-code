import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { ROUTES } from "../routes";
import { colors } from "../theme";

/** Minimal settings screen. Press esc to return home. */
export function Settings() {
  const navigate = useNavigate();

  useKeyboard((key) => {
    if (key.name === "escape") navigate(ROUTES.home);
  });

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Settings</text>
      <box flexDirection="column" alignItems="center">
        <text fg={colors.text}>Theme: dark</text>
        <text fg={colors.text}>Accent: {colors.accent}</text>
      </box>
      <text fg={colors.muted}>esc to go back</text>
    </box>
  );
}
