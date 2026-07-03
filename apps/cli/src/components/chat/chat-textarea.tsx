import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { getMode, getModelDisplayLabel, getModelSelection, getNextModeId } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useEffect, useRef, useState } from "react";
import { colors } from "../../theme";
import { EmptyBorder } from "../border";

type ChatTextareaProps = {
  /** Called with the trimmed message and the active mode id when the user submits. */
  onSubmit?: (value: string, modeId: ModeId) => void;
  placeholder?: string;
  /** Whether the textarea owns keyboard focus. */
  focused?: boolean;
  /** Active mode (controlled by the parent, which owns the state). */
  modeId: ModeId;
  /** Called when Tab/Shift+Tab cycles the mode. */
  onModeChange: (modeId: ModeId) => void;
};

// Enter submits; Shift+Enter (where the terminal reports it) inserts a newline.
const KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
];

/**
 * Multi-line chat input, modelled on opencode's prompt.
 *
 * The textarea is uncontrolled: we read its text from the renderable ref on
 * submit, then bump `generation` to remount it with an empty `initialValue`.
 *
 * `flexShrink={0}` keeps the fixed-height input from being squeezed to nothing
 * when it sits next to a `flexGrow` scrollback in the chat layout. Width is
 * capped by `ChatLayout`'s `CHAT_MAX_WIDTH` (or the home screen wrapper).
 *
 * Displays the active mode in the footer and cycles it with Tab/Shift+Tab, but the
 * mode is a *controlled* prop — the parent owns the state so it can also drive the
 * mode on regenerate/retry. Modes gate which tools the agent may use — see the
 * engine's `modes.ts`.
 */
export function ChatTextarea({
  onSubmit,
  placeholder = "Ask babal code anything…",
  focused = true,
  modeId,
  onModeChange,
}: ChatTextareaProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const [generation, setGeneration] = useState(0);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getModelSelection()
      .then(({ provider, model }) => getModelDisplayLabel(provider, model))
      .then(({ modelLabel, providerLabel }) => {
        if (cancelled) return;
        setModelLabel(modelLabel);
        setProviderLabel(providerLabel);
      })
      .catch(() => {
        if (!cancelled) {
          setModelLabel(null);
          setProviderLabel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tab cycles forward, Shift+Tab backward. Only the focused input reacts, so the
  // home and chat textareas don't both toggle (all useKeyboard handlers co-fire).
  // `useKeyboard` invokes the latest closure, so reading `modeId` here is never stale.
  useKeyboard((key) => {
    if (!focused || key.name !== "tab") return;
    onModeChange(getNextModeId(modeId, key.shift ? -1 : 1));
  });

  const handleSubmit = () => {
    const message = textareaRef.current?.plainText.trim() ?? "";
    if (message.length === 0) return;
    onSubmit?.(message, modeId);
    setGeneration((g) => g + 1);
  };

  // const borderColor = focused ? colors.accent : colors.muted;
  const modeColor = modeId === "plan" ? colors.plan : colors.accent;

  return (
    <box flexShrink={0} flexDirection="row" width="100%">
      <box border={["left"]} borderColor={modeColor} customBorderChars={{ ...EmptyBorder, vertical: "┃" }} />
      <box
        backgroundColor={colors.panel}
        paddingX={3}
        paddingY={1}
        flexDirection="column"
        flexGrow={1}
      >
        <textarea
          key={generation}
          ref={textareaRef}
          placeholder={placeholder}
          focused={focused}
          height={2}
          wrapMode="word"
          textColor={colors.text}
          cursorColor={colors.accent}
          placeholderColor={colors.muted}
          keyBindings={KEY_BINDINGS}
          onSubmit={handleSubmit}
        />
        <box flexDirection="row" justifyContent="space-between">
          <text>
            <span fg={modeColor}>{getMode(modeId).label}</span>
            {modelLabel && providerLabel ? (
              <>
                <span fg={colors.muted}> · </span>
                <span fg="#ffffff">{modelLabel}&nbsp;</span>
                <span fg="#808080">{providerLabel}</span>
              </>
            ) : null}
          </text>
          <text fg={colors.muted}>ctrl+c to exit</text>
        </box>
      </box>
    </box>
  );
}
