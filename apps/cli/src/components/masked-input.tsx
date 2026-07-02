import { decodePasteBytes, stripAnsiSequences, type PasteEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useState } from "react";
import { colors } from "../theme";

type MaskedInputProps = {
  /** Called with the trimmed secret when the user presses Enter. */
  onSubmit: (value: string) => void;
  /** Called when the user presses Esc. */
  onCancel?: () => void;
  placeholder?: string;
};

/**
 * A single-line secret input that renders bullets instead of the typed text.
 *
 * OpenTUI has no native password field, and a controlled `<input>` can't mask
 * cleanly (masking the `value` corrupts the edit buffer). So we own the buffer:
 * `useKeyboard` collects keystrokes, a paste handler collects pasted bytes (API
 * keys are almost always pasted), and we render bullets — with a Ctrl+R reveal
 * toggle. The real value never touches an `<input>`, the chat, or the session log.
 */
export function MaskedInput({ onSubmit, onCancel, placeholder = "" }: MaskedInputProps) {
  const renderer = useRenderer();
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);

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
    if (key.ctrl && key.name === "r") {
      setReveal((r) => !r);
      return;
    }
    // A printable character arrives as a single-char sequence with no modifiers;
    // special keys (arrows, function keys) come through as longer escape sequences.
    if (!key.ctrl && !key.meta && key.sequence.length === 1 && key.sequence >= " ") {
      setValue((v) => v + key.sequence);
    }
  });

  // React has no paste hook — subscribe to the renderer's paste event directly.
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
  const display = isEmpty ? placeholder : reveal ? value : "•".repeat(value.length);

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
      <text fg={colors.muted}>
        enter to save · ctrl+r to {reveal ? "hide" : "reveal"} · esc to cancel
      </text>
    </box>
  );
}
