import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import { getModelSelection } from "./config";
import { resolveApiKey } from "./credentials";
import { PROVIDERS } from "./providers";
import { SYSTEM_PROMPT } from "./system-prompt";
import { appendError, appendMessage } from "./session/store";
import { codingTools } from "./tools";

// Tools the model may call mid-turn. `execute` runs in-process; its result is
// streamed back as a tool part (rendered by the CLI's `ToolMessage`). The coding
// tools come from the registry; `getCurrentTime` is a self-contained example.
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
  ...codingTools,
};

/**
 * Run one agent turn in-process and return a UI message stream. This is the
 * headless core the CLI's transport wraps — no HTTP, no request parsing.
 *
 * Persistence mirrors the former chat route: the incoming user message is recorded
 * before streaming (so it survives a failed turn), the assistant response on finish,
 * and any failure as an error event. History is deduped by message id on read, so
 * re-sending the full history each turn does not duplicate.
 */
export async function runAgent({
  sessionId,
  messages,
}: {
  sessionId: string;
  messages: UIMessage[];
}): Promise<ReadableStream<UIMessageChunk>> {
  // Record the just-sent user message up front so it is kept even if the turn fails.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    void appendMessage(sessionId, lastMessage).catch(() => {});
  }

  // Resolve the provider/model (from `/model` config) and key (env → keychain) per
  // turn, so switching either via slash command takes effect on the next message
  // with no restart. A rejected promise here surfaces as the CLI's error banner.
  const { provider, model } = await getModelSelection();
  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    throw new Error(`No API key for ${PROVIDERS[provider].label}. Run /login to add one.`);
  }

  const result = streamText({
    model: PROVIDERS[provider].createModel(apiKey, model),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    // A coding turn chains many tool calls (list → read → edit → verify); without a
    // stop condition the run ends after the first tool call. Cap the loop generously.
    stopWhen: stepCountIs(25),
    // Gemini omits thinking tokens unless explicitly asked to include them.
    providerOptions: {
      google: { thinkingConfig: { includeThoughts: true } },
    },
  });

  // `sendReasoning` is required for reasoning parts to reach the UI message stream;
  // without it the CLI's `ReasoningMessage` branch never fires.
  return result.toUIMessageStream({
    sendReasoning: true,
    // Persistence mode: gives the response message a stable id we can store.
    originalMessages: messages,
    generateMessageId: generateId,
    onFinish: ({ responseMessage }) => {
      // A failed turn still fires `onFinish` with an empty assistant message — skip
      // it so the timeline only carries the error event.
      if (responseMessage.parts.length === 0) return;
      return appendMessage(sessionId, responseMessage);
    },
    onError: (error) => {
      // Record the failure at its timeline position, then surface it to the UI.
      void appendError(sessionId, error).catch(() => {});
      return error instanceof Error ? error.message : String(error);
    },
  });
}
