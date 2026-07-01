import { Hono } from "hono";
import { logger } from "hono/logger";
import { sessionRoutes } from "./routes/sessions";

const app = new Hono();

app.use(logger());

// Route groups MUST be chained via `.route()` so Hono can infer the types that
// power the RPC client. Mount each new group from `routes/` here.
const routes = app.route("/sessions", sessionRoutes);

/** The RPC contract consumed by clients (e.g. the CLI) via `hc<AppType>()`. */
export type AppType = typeof routes;

export { app };
