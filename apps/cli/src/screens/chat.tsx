import { useChat } from "@ai-sdk/react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { clearReadTracker, DEFAULT_MODE_ID, isModeId, permission } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { isToolUIPart, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  ChatError,
  ChatLayout,
  ChatTextarea,
  getChatBusyLabel,
  isChatBusy,
  PermissionPrompt,
  renderMessageParts,
  ToolSelectionContext,
} from "../components/chat";
import { useAppDialogs } from "../hooks/use-app-dialogs.tsx";
import { useLayerKeyboard } from "../services/layer";
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

  // Switching sessions must drop back to the loading gate *synchronously*, before the
  // `key={id}` remount fires. `useChat` reads its `messages` only at mount, and the id
  // change (hence the remount) is synchronous while the history load below is async. If
  // `initialMessages` still held the outgoing session's transcript at that remount, the
  // new `ChatView` would capture it and ignore the later async load (same key) — leaving
  // the freshly-opened session showing the previous conversation. Resetting to `null`
  // here (guarded by a ref so it only fires on an actual change) forces the gate, so
  // `ChatView` mounts exactly once, with the correct history.
  const loadedId = useRef(id);
  if (loadedId.current !== id) {
    loadedId.current = id;
    setInitialMessages(null);
  }

  // Switching/resuming a session must not inherit the previous conversation's file
  // read-state — the engine tracker is process-global, so reset it per active session.
  useEffect(() => {
    clearReadTracker();
  }, [id]);

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
  const { runCommand } = useAppDialogs();

  const [modeId, setModeId] = useState<ModeId>(initialModeId ?? DEFAULT_MODE_ID);

  const transport = useMemo(() => new InProcessTransport(), []);

  const { messages, sendMessage, status, error, regenerate, clearError } = useChat({
    id,
    messages: initialMessages,
    transport,
  });

  // Per-item tool-call navigation: `selectedId` highlights one call, `expandedIds`
  // holds the calls whose full output is shown. `toolIds` is the ordered list of
  // navigable calls, keyed the same way `renderMessageParts` keys its parts.
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

  // Pending permission requests from the engine broker. A mutating tool suspends its
  // turn awaiting approval; we render the head of the queue in the banner slot and
  // answer it via `permission.reply`. `subscribe`/`pending` are React-idiomatic
  // (useSyncExternalStore); `pending` returns a stable snapshot between changes.
  const pendingPermissions = useSyncExternalStore(permission.subscribe, permission.pending);
  const activePermission = pendingPermissions[0] ?? null;

  const toolIds = useMemo(
    () =>
      messages.flatMap((m) =>
        m.parts.flatMap((part, index) => (isToolUIPart(part) ? [`${m.id}-${index}`] : [])),
      ),
    [messages],
  );

  // ctrl+↑/↓ moves the highlight, ctrl+r expands the selected call. ctrl-modified
  // keys are used so plain arrows stay with the textarea cursor and scrollbox
  // scroll. Scoped to this screen's layer so an open dialog traps it (no tool
  // navigation behind the modal); it runs the latest closure, so `selectedId` is
  // never stale. Non-consuming — the textarea/scrollbox still see the key.
  useLayerKeyboard((key) => {
    if (!key.ctrl) return;
    if (key.name === "up" || key.name === "down") {
      setSelectedId((cur) => {
        if (toolIds.length === 0) return cur;
        const idx = cur ? toolIds.indexOf(cur) : -1;
        const target =
          idx === -1
            ? key.name === "up"
              ? toolIds.length - 1
              : 0
            : key.name === "up"
              ? Math.max(0, idx - 1)
              : Math.min(toolIds.length - 1, idx + 1);
        return toolIds[target] ?? cur;
      });
    } else if (key.name === "r" && selectedId) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(selectedId)) next.delete(selectedId);
        else next.add(selectedId);
        return next;
      });
    }
  });

  // Answer the active permission prompt: y = allow once, a = allow always
  // (persisted for this project), n = deny. The textarea is unfocused while a
  // prompt is up (see `focused` below), so these keys don't land as input text.
  // Layer-scoped so a dialog opened over the chat traps these keys.
  useLayerKeyboard((key) => {
    if (!activePermission) return;
    if (key.name === "y") permission.reply(activePermission.id, { type: "allow", scope: "once" });
    else if (key.name === "a")
      permission.reply(activePermission.id, { type: "allow", scope: "always" });
    else if (key.name === "n")
      permission.reply(activePermission.id, { type: "deny", scope: "once" });
  });

  // Scroll the newly selected call into view (nearest alignment).
  useEffect(() => {
    if (selectedId) scrollRef.current?.scrollChildIntoView(selectedId);
  }, [selectedId]);

  // Fire the first message exactly once for a freshly created session, in the active mode.
  const sent = useRef(false);
  useEffect(() => {
    if (initialText && !sent.current) {
      sent.current = true;
      sendMessage({ text: initialText, metadata: { modeId } }, { body: { modeId } });
    }
  }, [initialText, modeId, sendMessage]);

  const handleSubmit = (value: string, mode: ModeId) => {
    if (isChatBusy(status)) return;
    // Only a bare slash command runs as a command; the same text with trailing
    // args, in quotes, or mid-sentence falls through to be sent as a message.
    if (runCommand(value)) return;
    const text = value.trim();
    if (!text) return;
    sendMessage({ text, metadata: { modeId: mode } }, { body: { modeId: mode } });
  };

  const busyLabel = getChatBusyLabel(status, messages);

  return (
    <ChatLayout
      scrollRef={scrollRef}
      input={
        <ChatTextarea
          modeId={modeId}
          onModeChange={setModeId}
          onSubmit={handleSubmit}
          focused={!activePermission}
        />
      }
      banner={
        activePermission ? (
          <PermissionPrompt
            request={activePermission}
            queued={pendingPermissions.length - 1}
            onAllowOnce={() =>
              permission.reply(activePermission.id, { type: "allow", scope: "once" })
            }
            onAllowAlways={() =>
              permission.reply(activePermission.id, { type: "allow", scope: "always" })
            }
            onDeny={() => permission.reply(activePermission.id, { type: "deny", scope: "once" })}
          />
        ) : status === "error" && error ? (
          <ChatError
            message={error.message}
            onRetry={() => regenerate({ body: { modeId } })}
            onDismiss={clearError}
          />
        ) : null
      }
    >
      <ToolSelectionContext.Provider value={{ selectedId, expandedIds }}>
        {messages.flatMap((message, index) =>
          renderMessageParts(message, {
            // Stream-render only the last message while the turn is live, so its
            // trailing markdown block finalizes when generation completes.
            streaming: status === "streaming" && index === messages.length - 1,
          }),
        )}
      </ToolSelectionContext.Provider>
      {busyLabel && (
        <text fg={colors.muted} paddingLeft={4}>
          {busyLabel}
        </text>
      )}
    </ChatLayout>
  );
}
