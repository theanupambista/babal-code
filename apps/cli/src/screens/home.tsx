import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useNavigate } from "react-router";
import { Logo } from "../components/logo";
import { PromptInput } from "../components/prompt-input";
import { client } from "../lib/client";
import { colors } from "../theme";

/** Concatenates a UI message's text parts into a single string. */
function messageText(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

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

  const { messages, sendMessage, status, error } = useChat({
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
        <PromptInput onSubmit={handleSubmit} />
        <text fg={colors.muted}>type /settings to navigate</text>
      </box>
    );
  }

  // Once a conversation starts, switch to a top-anchored chat layout.
  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        <box flexDirection="column" gap={1}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <box key={message.id} flexDirection="column">
                <text fg={isUser ? colors.accent : colors.muted}>{isUser ? "you" : "babal"}</text>
                <text fg={colors.text}>{messageText(message) || " "}</text>
              </box>
            );
          })}
          {status === "submitted" && <text fg={colors.muted}>…thinking</text>}
          {error && <text fg={colors.muted}>Error: {error.message}</text>}
        </box>
      </scrollbox>

      <PromptInput onSubmit={handleSubmit} />
    </box>
  );
}
