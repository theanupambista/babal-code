import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { getMode, getNextModeId } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useRef, useState } from "react";
import { colors } from "../../theme";

type ChatTextareaProps = {
  /** Called with the trimmed message and the active mode id when the user submits. */
  onSubmit?: (value: string, modeId: ModeId) => void;
  placeholder?: string;
  /** Whether the textarea owns keyboard focus. */
  focused?: boolean;
  /** Visible height of the input in rows. */
  rows?: number;
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
 * when it sits next to a `flexGrow` scrollback in the chat layout.
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
  rows = 3,
  modeId,
  onModeChange,
}: ChatTextareaProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const [generation, setGeneration] = useState(0);

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

  return (
    <box flexDirection="column" flexShrink={0}>
      <box
        border
        borderStyle="rounded"
        borderColor={focused ? colors.accent : colors.muted}
        paddingLeft={1}
        paddingRight={1}
      >
        <textarea
          key={generation}
          ref={textareaRef}
          placeholder={placeholder}
          focused={focused}
          height={rows}
          wrapMode="word"
          textColor={colors.text}
          cursorColor={colors.accent}
          placeholderColor={colors.muted}
          keyBindings={KEY_BINDINGS}
          onSubmit={handleSubmit}
        />
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
        <text>
          <span fg={colors.accent}>◈ {getMode(modeId).label}</span>
          <span fg={colors.muted}> · tab to switch · enter to send</span>
        </text>
        <text fg={colors.muted}>ctrl+c to exit</text>
      </box>
    </box>
  );
}
