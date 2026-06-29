import { useNavigate } from "react-router";
import { Logo } from "../components/logo";
import { PromptInput } from "../components/prompt-input";
import { colors } from "../theme";

/**
 * Home screen: the ASCII wordmark stacked above the prompt input,
 * vertically and horizontally centred like opencode's start screen.
 */
export function Home() {
  const navigate = useNavigate();

  const handleSubmit = (value: string) => {
    const text = value.trim();
    // A slash command is just the route path: navigate to it and let the router
    // resolve it (unknown paths fall through to the `*` NotFound screen).
    if (text.startsWith("/")) {
      navigate(text.toLowerCase());
      return;
    }
    // TODO: treat non-command input as a real prompt (route to a session screen).
  };

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      <Logo />
      <PromptInput onSubmit={handleSubmit} />
      <text fg={colors.muted}>type /settings to navigate</text>
    </box>
  );
}
