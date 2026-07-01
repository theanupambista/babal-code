import { google } from "@ai-sdk/google";
import { prisma, type Prisma } from "@babalcode/db";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";

const MODEL_ID = "gemini-2.5-flash";

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
// The session id comes from the path param, not the body — `DefaultChatTransport`
// still sends an `id`, but we ignore it.
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

/** Next free position in a session's timeline. Errors and messages share it. */
async function nextSeq(sessionId: string): Promise<number> {
  const last = await prisma.entry.findFirst({
    where: { sessionId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  return (last?.seq ?? -1) + 1;
}

/**
 * Append a message to a session's timeline. Idempotent on `(sessionId,
 * messageId)` so a client re-send or retry updates in place instead of
 * duplicating — the whole history is re-sent on every turn.
 */
async function persistMessage(
  sessionId: string,
  message: { id?: string; role: string; parts: unknown },
): Promise<void> {
  const messageId = message.id ?? generateId();
  await prisma.entry.upsert({
    where: { sessionId_messageId: { sessionId, messageId } },
    create: {
      sessionId,
      seq: await nextSeq(sessionId),
      type: "message",
      messageId,
      role: message.role,
      parts: message.parts as Prisma.InputJsonValue,
    },
    update: {},
  });
}

/** Append a failure to the timeline at the point it occurred. */
async function persistError(sessionId: string, error: unknown): Promise<void> {
  await prisma.entry.create({
    data: {
      sessionId,
      seq: await nextSeq(sessionId),
      type: "error",
      errorText: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
    },
  });
}

/**
 * Session route group, mounted at `/sessions` by `app.ts`.
 *
 * Route groups follow this shape: a self-contained `Hono` instance whose routes
 * are chained (so Hono can infer the types that power the RPC client) and
 * exported for `app.route()` to mount. Add new groups as sibling files under
 * `routes/` and mount them the same way.
 */
export const sessionRoutes = new Hono()
  // Read a session's timeline as `UIMessage[]`, ready to seed the CLI's `useChat`.
  // Only message entries are replayed — errors stay in the DB for the record but
  // `useChat` treats errors as transient/live-only, so they are dropped here.
  // Returns an empty list for an unknown session so a freshly created (not yet
  // persisted) id can be fetched without a 404.
  .get("/:id/messages", async (c) => {
    const sessionId = c.req.param("id");
    const entries = await prisma.entry.findMany({
      where: { sessionId, type: "message" },
      orderBy: { seq: "asc" },
      select: { messageId: true, role: true, parts: true },
    });
    const messages = entries.map((e) => ({
      id: e.messageId ?? generateId(),
      role: e.role,
      parts: e.parts,
    }));
    return c.json({ messages });
  })
  // Multi-turn chat endpoint consumed by the CLI's `useChat`. Expects a UI
  // message stream request body and replies with the UI message stream protocol.
  // Every turn is persisted to the session so the full conversation — messages,
  // tool calls, reasoning, and errors — is recorded in order.
  .post("/:id/messages", zValidator("json", chatRequestSchema), async (c) => {
    const sessionId = c.req.param("id");
    const { messages } = c.req.valid("json");

    // Ensure the session exists; `update: {}` makes this a no-op on later turns.
    await prisma.session.upsert({
      where: { id: sessionId },
      create: { id: sessionId, model: MODEL_ID },
      update: {},
    });

    // Persist the just-sent user message before streaming so it is recorded even
    // if the assistant turn fails.
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      await persistMessage(sessionId, lastMessage);
    }

    const result = streamText({
      model: google(MODEL_ID),
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
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      // Persistence mode: gives the response message a stable id we can store.
      originalMessages: messages as UIMessage[],
      generateMessageId: generateId,
      onFinish: ({ responseMessage }) => {
        // A failed turn still fires `onFinish` with an empty assistant message —
        // skip it so the timeline only carries the `onError` entry.
        if (responseMessage.parts.length === 0) return;
        return persistMessage(sessionId, responseMessage);
      },
      onError: (error) => {
        // Record the failure at its timeline position, then surface it to the UI.
        void persistError(sessionId, error).catch(() => {});
        return error instanceof Error ? error.message : String(error);
      },
    });
  });
