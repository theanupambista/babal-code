import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { colors } from "../theme";
import { ROUTES } from "../routes";

/** Catch-all screen for unmatched routes. */
export function NotFound() {
  const navigate = useNavigate();

  useKeyboard((key) => {
    if (key.name === "escape") navigate(ROUTES.home);
  });
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Screen not found</text>
      <text fg={colors.muted}>The requested route does not exist.</text>
      <text fg={colors.muted}>esc to go back</text>
    </box>
  );
}
