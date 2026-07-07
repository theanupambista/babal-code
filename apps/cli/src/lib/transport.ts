import { DEFAULT_MODE_ID, isModeId, runAgent } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

/**
 * A `ChatTransport` that runs the agent **in-process** instead of over HTTP. This
 * is what makes the CLI monolithic: `useChat` streams straight from
 * `@babalcode/engine`'s `runAgent`, so there is no server and the workspace root is
 * this process's cwd. `chatId` is the session id the engine persists under.
 */
export class InProcessTransport implements ChatTransport<UIMessage> {
  async sendMessages({
    chatId,
    messages,
    body,
    abortSignal,
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    // Mode is client-owned: the CLI sends it via `sendMessage({ text }, { body: { modeId } })`
    // on every turn. `body` crosses the transport boundary untyped, so validate the id with the
    // engine's `isModeId` guard and fall back to the CLI's own default for a missing/unknown one
    // rather than letting it slip through to the engine.
    const rawModeId = (body as { modeId?: unknown } | undefined)?.modeId;
    const modeId: ModeId = isModeId(rawModeId) ? rawModeId : DEFAULT_MODE_ID;
    return runAgent({ sessionId: chatId, messages, mode: modeId, abortSignal });
  }

  // No persistent server-side stream exists to resume in-process.
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
