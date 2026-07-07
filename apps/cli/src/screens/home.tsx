import { generateId } from "ai";
import { DEFAULT_MODE_ID } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useState } from "react";
import { useNavigate } from "react-router";
import { CHAT_MAX_WIDTH, ChatTextarea } from "../components/chat";
import { Logo } from "../components/logo";
import { useAppDialogs } from "../hooks/use-app-dialogs.tsx";
import { ROUTES } from "../routes";

/**
 * Home screen: a centred ASCII wordmark above the prompt — the launcher.
 */
export function Home() {
  const navigate = useNavigate();
  const { runCommand } = useAppDialogs();
  const [modeId, setModeId] = useState<ModeId>(DEFAULT_MODE_ID);

  const handleSubmit = (value: string, modeId: ModeId) => {
    if (runCommand(value)) return;
    const text = value.trim();
    if (!text) return;
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
