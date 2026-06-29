import { Outlet } from "react-router";

/** App shell: hosts the routed screen and any future global keybindings. */
export function RootLayout() {
  return (
    <box flexGrow={1} flexDirection="column">
      <Outlet />
    </box>
  );
}
