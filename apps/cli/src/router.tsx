import { DEFAULT_PROVIDER, hasApiKey } from "@babalcode/engine";
import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Chat } from "./screens/chat";
import { Home } from "./screens/home";
import { Login } from "./screens/login";
import { ModelSelect } from "./screens/model-select";
import { NotFound } from "./screens/not-found";
import { SessionList } from "./screens/session-list";

// First run with no resolvable key (env or keychain) lands on `/login` instead of
// the old hard exit; an existing key opens straight to home. Env var still works.
const initialPath = hasApiKey(DEFAULT_PROVIDER) ? ROUTES.home : ROUTES.login;

export const router = createMemoryRouter(
  [
    {
      path: ROUTES.home,
      element: <RootLayout />,
      children: [
        { index: true, element: <Home /> },
        { path: "sessions", element: <SessionList /> },
        { path: "sessions/:id", element: <Chat /> },
        { path: "model", element: <ModelSelect /> },
        { path: "login", element: <Login /> },
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  { initialEntries: [initialPath] },
);
