import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { RouterProvider } from "react-router";
import { router } from "./router";

// Bring-your-own-key: the agent talks directly to the model provider from this
// process, so a Google Generative AI key must be present before we mount the UI.
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error(
    "Missing GOOGLE_GENERATIVE_AI_API_KEY.\n" +
      "babalcode uses your own Google Generative AI key. Set it and try again, e.g.:\n" +
      "  export GOOGLE_GENERATIVE_AI_API_KEY=your-key   (macOS/Linux)\n" +
      "  $env:GOOGLE_GENERATIVE_AI_API_KEY=\"your-key\"    (PowerShell)",
  );
  process.exit(1);
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<RouterProvider router={router} />);
