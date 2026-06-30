import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

// Routes MUST be chained so Hono can infer the types that power the RPC client.
const routes = app
  .get("/", (c) => c.json({ name: "@babalcode/server", status: "ok" }))
  .get("/health", (c) =>
    c.json({ status: "healthy", uptime: process.uptime() }),
  )
  // Temporary smoke test for the AI SDK. Streams plain text — visit
  // /ai?prompt=hello in the browser to watch tokens arrive.
  .get("/ai", (c) => {
    const prompt = c.req.query("prompt") ?? "Say hello in one short sentence.";
    const result = streamText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    return result.toTextStreamResponse();
  })
  // Multi-turn chat endpoint consumed by the CLI's `useChat`. Expects a UI
  // message stream request body and replies with the UI message stream protocol.
  .post("/chat", async (c) => {
    const { messages } = await c.req.json<{ messages: UIMessage[] }>();
    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: await convertToModelMessages(messages),
    });
    return result.toUIMessageStreamResponse();
  });

/** The RPC contract consumed by clients (e.g. the CLI) via `hc<AppType>()`. */
export type AppType = typeof routes;

export { app };
