import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { RouterProvider } from "react-router";
import { router } from "./router";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<RouterProvider router={router} />);
