import { useChat } from "@ai-sdk/react";
import { DEFAULT_MODE_ID, isModeId } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ChatError, ChatLayout, ChatTextarea, renderMessageParts } from "../components/chat";
import { loadMessages } from "../lib/session";
import { InProcessTransport } from "../lib/transport";
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
  const locationState = useLocation().state as
    | { initialText?: string; initialModeId?: string }
    | undefined;
  const initialText = locationState?.initialText;
  // defaults to `DEFAULT_MODE_ID` (e.g. a resumed session carries no mode).
  const rawModeId = locationState?.initialModeId;
  const initialModeId: ModeId | undefined = isModeId(rawModeId) ? rawModeId : undefined;

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    if (!id) return;
    // A new session carries its first message in router state; nothing to load.
    if (initialText) {
      setInitialMessages([]);
      return;
    }
    let cancelled = false;
    void loadMessages(id)
      .then((messages) => {
        if (!cancelled) setInitialMessages(messages);
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
    <ChatView
      key={id}
      id={id}
      initialMessages={initialMessages}
      initialText={initialText}
      initialModeId={initialModeId}
    />
  );
}

function ChatView({
  id,
  initialMessages,
  initialText,
  initialModeId,
}: {
  id: string;
  initialMessages: UIMessage[];
  initialText?: string;
  initialModeId?: ModeId;
}) {
  const navigate = useNavigate();

  const [modeId, setModeId] = useState<ModeId>(initialModeId ?? DEFAULT_MODE_ID);

  const transport = useMemo(() => new InProcessTransport(), []);

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat({
    id,
    messages: initialMessages,
    transport,
  });

  // Fire the first message exactly once for a freshly created session, in the active mode.
  const sent = useRef(false);
  useEffect(() => {
    if (initialText && !sent.current) {
      sent.current = true;
      sendMessage({ text: initialText, metadata: { modeId } }, { body: { modeId } });
    }
  }, [initialText, modeId, sendMessage]);

  const handleSubmit = (value: string, mode: ModeId) => {
    const text = value.trim();
    if (!text) return;
    if (text.startsWith("/")) {
      navigate(text.toLowerCase());
      return;
    }
    sendMessage({ text, metadata: { modeId: mode } }, { body: { modeId: mode } });
  };

  return (
    <ChatLayout
      input={
        <ChatTextarea modeId={modeId} onModeChange={setModeId} onSubmit={handleSubmit} />
      }
      banner={
        status === "error" && error ? (
          <ChatError
            message={error.message}
            onRetry={() => regenerate({ body: { modeId } })}
            onDismiss={clearError}
          />
        ) : null
      }
    >
      {messages.flatMap(renderMessageParts)}
      {status === "submitted" && <text fg={colors.muted}>…thinking</text>}
    </ChatLayout>
  );
}
