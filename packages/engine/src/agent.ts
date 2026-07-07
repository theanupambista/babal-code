import {
  convertToModelMessages,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { getModelSelection } from "./config";
import { resolveApiKey, resolveCustomModelKey } from "./credentials";
import { getMode } from "./modes";
import { permission } from "./permission";
import { PROVIDERS, resolveLanguageModel } from "./providers";
import { getSystemPrompt } from "./prompts";
import { appendError, appendMessage } from "./session/store";
import { codingTools } from "./tools";

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
  mode,
}: {
  sessionId: string;
  messages: UIMessage[];
  mode: string;
}): Promise<ReadableStream<UIMessageChunk>> {
  // Record the just-sent user message up front so it is kept even if the turn fails.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    void appendMessage(sessionId, lastMessage).catch(() => {});
  }

  // Resolve the provider/model (from `/model` config) and key (env → keychain) per
  // turn, so switching either via slash command takes effect on the next message
  // with no restart. A rejected promise here surfaces as the CLI's error banner.
  const selection = await getModelSelection();
  if (!selection) {
    throw new Error("No model selected. Open /model to choose a model.");
  }
  const { provider, model, customModelId } = selection;
  const providerInfo = PROVIDERS[provider];
  const apiKey =
    provider === "custom"
      ? customModelId
        ? resolveCustomModelKey(customModelId)
        : resolveApiKey("custom")
      : resolveApiKey(provider);
  if (providerInfo.requiresApiKey !== false && !apiKey) {
    throw new Error(`No API key for ${providerInfo.label}. Open /model to add one.`);
  }

  const languageModel = await resolveLanguageModel(provider, model, apiKey);

  // Resolve the active mode from the caller-supplied id. A mode injects extra system
  // instructions and restricts the toolset to its allowlist; "all" = every tool.
  const activeMode = getMode(mode);
  // Tell the permission broker which mode this turn runs in, so its `autoAllow`
  // list (Build auto-allows writeFile/editFile) shapes default permission actions.
  permission.setActiveMode(activeMode.id);
  const activeTools =
    activeMode.tools === "all"
      ? codingTools
      : Object.fromEntries(
          Object.entries(codingTools).filter(([name]) =>
            (activeMode.tools as readonly string[]).includes(name),
          ),
        );

  const basePrompt = getSystemPrompt({
    enabledTools: new Set(Object.keys(activeTools)),
  });
  const system = activeMode.instructions
    ? `${basePrompt}\n\n${activeMode.instructions}`
    : basePrompt;

  const result = streamText({
    model: languageModel,
    system,
    messages: await convertToModelMessages(messages),
    tools: activeTools,
    // A coding turn chains many tool calls (list → read → edit → verify); without a
    // stop condition the run ends after the first tool call. Cap the loop generously.
    stopWhen: stepCountIs(25),
    // Gemini omits thinking tokens unless explicitly asked to include them.
    ...(provider === "google"
      ? { providerOptions: { google: { thinkingConfig: { includeThoughts: true } } } }
      : {}),
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
