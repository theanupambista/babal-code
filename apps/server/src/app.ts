import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

// Routes MUST be chained so Hono can infer the types that power the RPC client.
const routes = app
  .get("/", (c) => c.json({ name: "@babalcode/server", status: "ok" }))
  .get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }));

/** The RPC contract consumed by clients (e.g. the CLI) via `hc<AppType>()`. */
export type AppType = typeof routes;

export { app };
