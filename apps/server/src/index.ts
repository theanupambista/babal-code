import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

app.get("/", (c) => c.json({ name: "@babalcode/server", status: "ok" }));

app.get("/health", (c) => c.json({ status: "healthy", uptime: process.uptime() }));

const port = Number(process.env.PORT ?? 3000);

console.log(`🔥 @babalcode/server listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
