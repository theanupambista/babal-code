import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { RouterProvider } from "react-router";
import { router } from "./router";

// Bring-your-own-key, but no longer a hard requirement at startup: if no key is
// resolvable the router opens on `/login` (see `router.tsx`) so the user can add
// one from inside the TUI. Keys live in the OS keychain; the env var still works.
const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<RouterProvider router={router} />);
