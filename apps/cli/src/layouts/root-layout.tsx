import { Outlet } from "react-router";
import { DialogProvider } from "../components/dialog";
import { UpdateBanner } from "../components/update-banner";
import { useUpdateCheck } from "../hooks/use-update-check";
import { colors } from "../theme";

/** App shell: hosts the routed screen and any future global keybindings. */
export function RootLayout() {
  const update = useUpdateCheck();

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
        {update && (
          <box paddingTop={1} paddingLeft={1} paddingRight={1} alignItems="center">
            <UpdateBanner update={update} />
          </box>
        )}
        <Outlet />
      </DialogProvider>
    </box>
  );
}
