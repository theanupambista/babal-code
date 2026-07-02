import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Chat } from "./screens/chat";
import { Home } from "./screens/home";
import { NotFound } from "./screens/not-found";
import { SessionList } from "./screens/session-list";

export const router = createMemoryRouter([
  {
    path: ROUTES.home,
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "sessions", element: <SessionList /> },
      { path: "sessions/:id", element: <Chat /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
