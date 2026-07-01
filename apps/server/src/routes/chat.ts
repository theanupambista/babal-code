import { google } from "@ai-sdk/google";
import { zValidator } from "@hono/zod-validator";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { Hono } from "hono";
import { z } from "zod";

// Tools the model may call mid-turn. `execute` runs server-side; its result is
// streamed back as a tool part (rendered by the CLI's `ToolMessage`). Keep these
// self-contained — no external services — so the endpoint stays dependency-free.
const tools = {
  getCurrentTime: tool({
    description: "Get the current date and time. Use when the user asks what time or date it is.",
    inputSchema: z.object({
      timeZone: z
        .string()
        .optional()
        .describe("IANA time zone, e.g. 'America/New_York'. Defaults to UTC."),
    }),
    execute: async ({ timeZone }) => {
      const now = new Date();
      const zone = timeZone ?? "UTC";
      return {
        iso: now.toISOString(),
        timeZone: zone,
        formatted: now.toLocaleString("en-US", { timeZone: zone, timeZoneName: "short" }),
      };
    },
  }),
};

// Loosely validates the shape `convertToModelMessages` needs. Parts are kept
// permissive (passthrough) since the AI SDK does the deep per-part validation.
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(z.object({ type: z.string() }).passthrough()),
      }),
    )
    .min(1),
});

/**
 * Chat route group, mounted at `/chat` by `app.ts`.
 *
 * Route groups follow this shape: a self-contained `Hono` instance whose routes
 * are chained (so Hono can infer the types that power the RPC client) and
 * exported for `app.route()` to mount. Add new groups as sibling files under
 * `routes/` and mount them the same way.
 */
export const chatRoutes = new Hono()
  // Multi-turn chat endpoint consumed by the CLI's `useChat`. Expects a UI
  // message stream request body and replies with the UI message stream protocol.
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const { messages } = c.req.valid("json");
    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: await convertToModelMessages(messages as UIMessage[]),
      tools,
      // Without a stop condition the run ends after the tool call; `stepCountIs`
      // lets the model take another step to turn the tool result into an answer.
      stopWhen: stepCountIs(5),
      // Gemini omits thinking tokens unless explicitly asked to include them.
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
    });
    // `sendReasoning` is required for reasoning parts to reach the UI message
    // stream; without it the CLI's `ReasoningMessage` branch never fires.
    return result.toUIMessageStreamResponse({ sendReasoning: true });
  });
