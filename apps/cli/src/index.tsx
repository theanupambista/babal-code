#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { RouterProvider } from "react-router";
import { createAppRouter } from "./router";
import { LayerProvider } from "./services/layer";

// Bring-your-own-key, but no longer a hard requirement at startup: if no key is
// resolvable the router opens on `/login` (see `router.tsx`) so the user can add
// one from inside the TUI. Keys live in the OS keychain; the env var still works.
//
// `exitOnCtrlC: false` hands Ctrl+C to the layer service instead of quitting
// unconditionally: `LayerProvider` routes it through the stack (so a focused
// input can clear itself, a dialog can close) and only quits when it reaches the
// bottom unclaimed.
const renderer = await createCliRenderer({ exitOnCtrlC: false });
const router = await createAppRouter();
createRoot(renderer).render(
  <LayerProvider onExit={() => renderer.destroy()}>
    <RouterProvider router={router} />
  </LayerProvider>,
);
