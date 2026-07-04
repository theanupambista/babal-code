import { useRenderer } from "@opentui/react";
import { generateId } from "ai";
import { DEFAULT_MODE_ID } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useState } from "react";
import { useNavigate } from "react-router";
import { runSlashCommand } from "../commands";
import { CHAT_MAX_WIDTH, ChatTextarea } from "../components/chat";
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
  const renderer = useRenderer();
  const [modeId, setModeId] = useState<ModeId>(DEFAULT_MODE_ID);

  const handleSubmit = (value: string, modeId: ModeId) => {
    // A bare slash command runs as a command (navigate to its route, or `/clear`/
    // `/exit`); the same text with trailing args, in quotes, or mid-sentence is
    // not bare and falls through to be submitted as a normal message.
    if (runSlashCommand(value, { navigate, exit: () => renderer.destroy() })) return;
    const text = value.trim();
    if (!text) return;
    // Carry the chosen mode so the Chat screen's first turn runs in it.
    const id = generateId();
    navigate(ROUTES.session(id), { state: { initialText: text, initialModeId: modeId } });
  };

  return (
    <box flexGrow={1} flexDirection="column" justifyContent="center" gap={2} padding={1}>
      <box alignItems="center">
        <Logo />
      </box>
      <box alignItems="center" width="100%">
        <box width="100%" maxWidth={CHAT_MAX_WIDTH}>
          <ChatTextarea modeId={modeId} onModeChange={setModeId} onSubmit={handleSubmit} />
        </box>
      </box>
    </box>
  );
}
