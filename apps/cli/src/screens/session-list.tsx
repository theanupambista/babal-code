import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { client } from "../lib/client";
import { ROUTES } from "../routes";
import { colors } from "../theme";

type SessionSummary = {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
};

/** Compact "3m ago" / "2h ago" / "5d ago" label from an ISO timestamp. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Session picker for `/sessions` — lists past conversations newest-first and
 * navigates into the chosen one. Reached via the `/sessions` slash command.
 */
export function SessionList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void client.sessions
      .$get()
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSessions(data.sessions as SessionSummary[]);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === "escape") navigate(ROUTES.home);
  });

  if (sessions === null) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg={colors.muted}>…loading sessions</text>
      </box>
    );
  }

  if (sessions.length === 0) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
        <text fg={colors.accent}>No sessions yet</text>
        <text fg={colors.muted}>Start a conversation from the home screen.</text>
        <text fg={colors.muted}>esc to go back</text>
      </box>
    );
  }

  const options = sessions.map((session) => ({
    name: truncate(session.title ?? session.preview ?? "(untitled)", 60),
    description: `${relativeTime(session.updatedAt)}${session.model ? ` · ${session.model}` : ""}`,
    value: session.id,
  }));

  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <text fg={colors.accent}>Sessions</text>
      <select
        flexGrow={1}
        focused
        options={options}
        showScrollIndicator
        selectedBackgroundColor={colors.accent}
        selectedTextColor="#000000"
        onSelect={(_index, option) => {
          if (option) navigate(ROUTES.session(option.value as string));
        }}
      />
      <text fg={colors.muted}>↑/↓ to navigate · enter to open · esc to go back</text>
    </box>
  );
}
