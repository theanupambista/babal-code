import { createMemoryRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { ROUTES } from "./routes";
import { Home } from "./screens/home";
import { NotFound } from "./screens/not-found";

export const router = createMemoryRouter([
  {
    path: ROUTES.home,
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
