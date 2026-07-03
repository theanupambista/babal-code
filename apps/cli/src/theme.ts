/** Shared color palette for the CLI UI. */
export const colors = {
  /** App shell background. */
  background: "#0A0A0A",
  /** Elevated panel surface — prompt input and user messages. */
  panel: "#1E1E1E",
  /** Primary / accent — banner, focused borders, cursor, build mode. */
  accent: "#f05100",
  /** Plan mode label in the prompt footer. */
  plan: "#9ece6a",
  /** Default body text. */
  text: "#c0caf5",
  /** Secondary / muted text and unfocused borders. */
  muted: "#565f89",
  /** Failures — error banner and failed tool calls. */
  danger: "#f7768e",
} as const;
