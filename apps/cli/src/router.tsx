import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Chat } from "./screens/chat";
import { Home } from "./screens/home";
import { NotFound } from "./screens/not-found";

/**
 * Build the app router. The app always opens on home — there is no forced
 * login redirect. When no model is selected (or its provider has no key), the
 * home prompt shows a "No model" state and blocks sending until the user picks a
 * model via `/model`, which collects any missing key inline. See
 * `components/dialog/model-dialog.tsx` and `components/chat/chat-textarea.tsx`.
 */
export async function createAppRouter() {
  return createMemoryRouter(
    [
      {
        path: ROUTES.home,
        element: <RootLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "sessions/:id", element: <Chat /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
    { initialEntries: [ROUTES.home] },
  );
}
