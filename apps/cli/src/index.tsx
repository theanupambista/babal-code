import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Home } from "./screens/home";

function App() {
  return <Home />;
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
