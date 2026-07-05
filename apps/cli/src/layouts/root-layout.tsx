import { Outlet } from "react-router";
import { DialogProvider } from "../components/dialog";
import { colors } from "../theme";

/** App shell: hosts the routed screen and any future global keybindings. */
export function RootLayout() {
  return (
    <box
      position="relative"
      flexGrow={1}
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={colors.background}
    >
      {/* Positioned, screen-filling host so the dialog overlay can cover the app. */}
      <DialogProvider>
        <Outlet />
      </DialogProvider>
    </box>
  );
}
