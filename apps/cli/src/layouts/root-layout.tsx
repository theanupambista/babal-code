import { Outlet } from "react-router";
import { colors } from "../theme";

/** App shell: hosts the routed screen and any future global keybindings. */
export function RootLayout() {
  return (
    <box flexGrow={1} flexDirection="column" backgroundColor={colors.background}>
      <Outlet />
    </box>
  );
}
