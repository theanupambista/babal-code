import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useNavigate } from "react-router";
import { ChatError, ChatLayout, ChatTextarea, renderMessageParts } from "../components/chat";
import { Logo } from "../components/logo";
import { client } from "../lib/client";
import { colors } from "../theme";

/**
 * Home screen: a centred ASCII wordmark above the prompt until the first
 * message, then a top-anchored chat that streams assistant replies
 * token-by-token from the server's POST /chat endpoint via `useChat`.
 *
 * A slash command (input starting with `/`) navigates to the matching route;
 * any other input is sent as a chat message.
 */
export function Home() {
  const navigate = useNavigate();

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat({
    transport: new DefaultChatTransport({ api: client.chat.$url().toString() }),
  });

  const handleSubmit = (value: string) => {
    const text = value.trim();
    // A slash command is just the route path: navigate to it and let the router
    // resolve it (unknown paths fall through to the `*` NotFound screen).
    if (text.startsWith("/")) {
      navigate(text.toLowerCase());
      return;
    }
    sendMessage({ text });
  };

  // Before the first message, keep the centred launcher look.
  if (messages.length === 0) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
        <Logo />
        <box width={64}>
          <ChatTextarea onSubmit={handleSubmit} />
        </box>
      </box>
    );
  }

  // Once a conversation starts, switch to the top-anchored chat shell.
  return (
    <ChatLayout
      input={<ChatTextarea onSubmit={handleSubmit} />}
      banner={
        status === "error" && error ? (
          <ChatError message={error.message} onRetry={() => regenerate()} onDismiss={clearError} />
        ) : null
      }
    >
      {messages.flatMap(renderMessageParts)}
      {status === "submitted" && <text fg={colors.muted}>…thinking</text>}
    </ChatLayout>
  );
}
