import { canStartApp } from "@babalcode/engine";
import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Chat } from "./screens/chat";
import { CustomSetup } from "./screens/custom-setup";
import { Home } from "./screens/home";
import { Login } from "./screens/login";
import { ModelSelect } from "./screens/model-select";
import { NotFound } from "./screens/not-found";
import { SessionList } from "./screens/session-list";

/** Build the app router after resolving whether any provider is ready to use. */
export async function createAppRouter() {
  const initialPath = (await canStartApp()) ? ROUTES.home : ROUTES.login;

  return createMemoryRouter(
    [
      {
        path: ROUTES.home,
        element: <RootLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "sessions", element: <SessionList /> },
          { path: "sessions/:id", element: <Chat /> },
          { path: "model", element: <ModelSelect /> },
          { path: "custom", element: <CustomSetup /> },
          { path: "login", element: <Login /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}
