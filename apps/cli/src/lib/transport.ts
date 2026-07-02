import { runAgent } from "@babalcode/engine";
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
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    return runAgent({ sessionId: chatId, messages });
  }

  // No persistent server-side stream exists to resume in-process.
  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
