import { generateId } from "ai";
import { useNavigate } from "react-router";
import { ChatTextarea } from "../components/chat";
import { Logo } from "../components/logo";
import { ROUTES } from "../routes";

/**
 * Home screen: a centred ASCII wordmark above the prompt — the launcher.
 *
 * A slash command (input starting with `/`) navigates to the matching route.
 * Any other input starts a new conversation: we mint a client-side session id
 * and navigate to `/sessions/:id`, handing the typed text to the Chat screen
 * (which owns the `useChat` instance) so the first turn isn't lost to a remount.
 */
export function Home() {
  const navigate = useNavigate();

  const handleSubmit = (value: string) => {
    const text = value.trim();
    if (!text) return;
    // A slash command is just the route path: navigate to it and let the router
    // resolve it (unknown paths fall through to the `*` NotFound screen).
    if (text.startsWith("/")) {
      navigate(text.toLowerCase());
      return;
    }
    // The session id is client-generated; the server upserts it on first message.
    const id = generateId();
    navigate(ROUTES.session(id), { state: { initialText: text } });
  };

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      <Logo />
      <box width={64}>
        <ChatTextarea onSubmit={handleSubmit} />
      </box>
    </box>
  );
}
