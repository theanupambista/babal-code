import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Chat } from "./screens/chat";
import { Home } from "./screens/home";
import { NotFound } from "./screens/not-found";

/**
 * Build the app router. The app always opens on home. When no model is selected,
 * the home prompt shows a "No model" state and blocks sending until the user
 * connects a provider via `/connect` or picks a model via `/models`.
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
