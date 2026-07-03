import { decodePasteBytes, stripAnsiSequences, type PasteEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useState } from "react";
import { colors } from "../theme";

type TextInputProps = {
  /** Called with the trimmed value when the user presses Enter. */
  onSubmit: (value: string) => void;
  /** Called when the user presses Esc. */
  onCancel?: () => void;
  placeholder?: string;
  /** Initial value when editing existing config. */
  defaultValue?: string;
};

/**
 * Single-line plain text input — same keyboard/paste model as `MaskedInput`, without masking.
 */
export function TextInput({ onSubmit, onCancel, placeholder = "", defaultValue = "" }: TextInputProps) {
  const renderer = useRenderer();
  const [value, setValue] = useState(defaultValue);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel?.();
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      const trimmed = value.trim();
      if (trimmed) onSubmit(trimmed);
      return;
    }
    if (key.name === "backspace") {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (!key.ctrl && !key.meta && key.sequence.length === 1 && key.sequence >= " ") {
      setValue((v) => v + key.sequence);
    }
  });

  useEffect(() => {
    const handlePaste = (event: PasteEvent) => {
      const text = stripAnsiSequences(decodePasteBytes(event.bytes)).replace(/[\r\n]+/g, "");
      if (text) setValue((v) => v + text);
    };
    renderer.keyInput.on("paste", handlePaste);
    return () => {
      renderer.keyInput.off("paste", handlePaste);
    };
  }, [renderer]);

  const isEmpty = value.length === 0;
  const display = isEmpty ? placeholder : value;

  return (
    <box flexDirection="column" gap={1}>
      <box
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={isEmpty ? colors.muted : colors.text}>{display || " "}</text>
      </box>
      <text fg={colors.muted}>enter to continue · esc to cancel</text>
    </box>
  );
}
