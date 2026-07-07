#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { RouterProvider } from "react-router";
import { createAppRouter } from "./router";
import { LayerProvider } from "./services/layer";

// Bring-your-own-key, but not a hard requirement at startup: the app always opens
// on home. If no model is selected, the prompt shows a "No model" state and the
// user picks one via `/model`, which collects any missing key inline. Keys live in
// the OS keychain; the provider env vars still work.
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
