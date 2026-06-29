import type { TextareaRenderable } from "@opentui/core";
import { useRef, useState } from "react";
import { colors } from "../theme";

type PromptInputProps = {
  /** Called with the trimmed message when the user submits. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Whether the textarea owns keyboard focus. */
  focused?: boolean;
};

// Enter submits; Shift+Enter (where the terminal reports it) inserts a newline.
const KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
];

/**
 * Multi-line prompt box for the home screen, modelled on opencode's input.
 *
 * The textarea is uncontrolled: we read its text from the renderable ref on
 * submit, then bump `generation` to remount it with an empty `initialValue`.
 */
export function PromptInput({
  onSubmit,
  placeholder = "Ask babal code anything…",
  focused = true,
}: PromptInputProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const [generation, setGeneration] = useState(0);

  const handleSubmit = () => {
    const message = textareaRef.current?.plainText.trim() ?? "";
    if (message.length === 0) return;
    onSubmit?.(message);
    setGeneration((g) => g + 1);
  };

  return (
    <box flexDirection="column" width={64}>
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
          height={3}
          wrapMode="word"
          textColor={colors.text}
          cursorColor={colors.accent}
          placeholderColor={colors.muted}
          keyBindings={KEY_BINDINGS}
          onSubmit={handleSubmit}
        />
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
        <text fg={colors.muted}>enter to send · shift+enter for newline</text>
        <text fg={colors.muted}>ctrl+c to exit</text>
      </box>
    </box>
  );
}
