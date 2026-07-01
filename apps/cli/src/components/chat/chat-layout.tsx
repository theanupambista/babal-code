import type { ReactNode } from "react";
import { ChatMessages } from "./chat-messages";

type ChatLayoutProps = {
  /** Message history — typically a list of `*Message` components. */
  children: ReactNode;
  /** Docked input area, usually a `<ChatTextarea />`. */
  input: ReactNode;
  /** Optional element docked between the history and input (e.g. an error banner). */
  banner?: ReactNode;
};

/**
 * Chat shell: a scrollable message history that fills the screen with a docked
 * input beneath it. The history flex-grows; the banner and input keep their own
 * height (see `ChatTextarea`'s `flexShrink={0}`).
 */
export function ChatLayout({ children, input, banner }: ChatLayoutProps) {
  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <ChatMessages>{children}</ChatMessages>
      {banner}
      {input}
    </box>
  );
}
