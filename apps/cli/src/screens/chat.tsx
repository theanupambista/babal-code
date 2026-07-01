import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ChatError, ChatLayout, ChatTextarea, renderMessageParts } from "../components/chat";
import { client } from "../lib/client";
import { colors } from "../theme";

/**
 * Conversation screen for `/sessions/:id`.
 *
 * Two entry paths:
 * - **New** (navigated from Home with `initialText` in router state): mount with
 *   no history and fire the first message once.
 * - **Resume** (opened cold): fetch the persisted timeline first, then mount the
 *   chat seeded with it.
 *
 * The fetch must resolve before `useChat` mounts — the hook reads its initial
 * `messages` only once — so this wrapper gates rendering on load, then hands the
 * resolved history to `ChatView`. `key={id}` remounts the inner view (and its
 * `useChat`) whenever the session changes.
 */
export function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const initialText = useLocation().state?.initialText as string | undefined;

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    if (!id) return;
    // A new session carries its first message in router state; nothing to load.
    if (initialText) {
      setInitialMessages([]);
      return;
    }
    let cancelled = false;
    void client.sessions[":id"].messages
      .$get({ param: { id } })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setInitialMessages(data.messages as unknown as UIMessage[]);
      })
      .catch(() => {
        if (!cancelled) setInitialMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, initialText]);

  if (!id) {
    navigate("/");
    return null;
  }

  if (initialMessages === null) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg={colors.muted}>…loading session</text>
      </box>
    );
  }

  return (
    <ChatView key={id} id={id} initialMessages={initialMessages} initialText={initialText} />
  );
}

function ChatView({
  id,
  initialMessages,
  initialText,
}: {
  id: string;
  initialMessages: UIMessage[];
  initialText?: string;
}) {
  const navigate = useNavigate();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: client.sessions[":id"].messages.$url({ param: { id } }).toString(),
      }),
    [id],
  );

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat({
    id,
    messages: initialMessages,
    transport,
  });

  // Fire the first message exactly once for a freshly created session.
  const sent = useRef(false);
  useEffect(() => {
    if (initialText && !sent.current) {
      sent.current = true;
      sendMessage({ text: initialText });
    }
  }, [initialText, sendMessage]);

  const handleSubmit = (value: string) => {
    const text = value.trim();
    if (!text) return;
    if (text.startsWith("/")) {
      navigate(text.toLowerCase());
      return;
    }
    sendMessage({ text });
  };

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
