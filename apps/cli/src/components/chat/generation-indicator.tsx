import { useEffect, useState } from "react";
import { colors } from "../../theme";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const DOT_FRAMES = ["", ".", "..", "..."] as const;

/** Normalize labels like "…thinking" → "thinking". */
function formatLabel(label: string): string {
  return label.replace(/^…+/, "").trim() || "working";
}

type GenerationIndicatorProps = {
  /** Contextual status from the active turn, e.g. "…responding". */
  label: string;
};

/**
 * Animated footer hint shown while the agent is generating — braille spinner,
 * pulsing ellipsis, and an esc-to-stop affordance.
 */
export function GenerationIndicator({ label }: GenerationIndicatorProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [dotFrame, setDotFrame] = useState(0);

  useEffect(() => {
    const spinner = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    const dots = setInterval(() => {
      setDotFrame((f) => (f + 1) % DOT_FRAMES.length);
    }, 400);
    return () => {
      clearInterval(spinner);
      clearInterval(dots);
    };
  }, []);

  const text = formatLabel(label);

  return (
    <text>
      <span fg={colors.accent}>{SPINNER_FRAMES[spinnerFrame]} </span>
      <span fg={colors.muted}>
        {text}
        {DOT_FRAMES[dotFrame]}
      </span>
      <span fg={colors.muted}> · esc to stop</span>
    </text>
  );
}
