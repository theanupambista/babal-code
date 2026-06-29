import { Logo } from "../components/logo";
import { PromptInput } from "../components/prompt-input";

type HomeProps = {
  onSubmit?: (value: string) => void;
};

/**
 * Home screen: the ASCII wordmark stacked above the prompt input,
 * vertically and horizontally centred like opencode's start screen.
 */
export function Home({ onSubmit }: HomeProps) {
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      <Logo />
      <PromptInput onSubmit={onSubmit} />
    </box>
  );
}
