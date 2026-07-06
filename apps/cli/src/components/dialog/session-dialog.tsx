import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { listSessions, type SessionSummary } from "../../lib/session";
import { ROUTES } from "../../routes";
import { colors } from "../../theme";
import { useDialog } from "./dialog-context";
import { DialogSearchList } from "./dialog-search-list";

/**
 * Width of the Sessions dialog, in columns — wider than the default so session
 * titles have room to sit on a single line.
 */
export const SESSION_DIALOG_WIDTH = 80;

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
 * Body slot for the "Sessions" dialog: past conversations listed newest-first as
 * a scrollable list. Choosing one closes the dialog and navigates into it.
 *
 * Extracted from the former `/sessions` screen so the picker lives in a dialog
 * over the current screen instead of a full-page navigation — bailing out with
 * esc leaves the live conversation behind it untouched (no remount, no reload).
 * The dialog chrome (title, `esc`) is owned by `Dialog`; this only renders the
 * list.
 */
export function SessionListBody() {
  const navigate = useNavigate();
  const { close } = useDialog();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listSessions()
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sessions === null) return <text fg={colors.muted}>…loading sessions</text>;

  if (sessions.length === 0) {
    return <text fg={colors.muted}>No sessions yet — start a conversation from the home screen.</text>;
  }

  const items = sessions.map((session) => ({
    name: truncate(session.title ?? session.preview ?? "(untitled)", 70),
    description: `${relativeTime(session.updatedAt)}${session.model ? ` · ${session.model}` : ""}`,
    value: session.id,
  }));

  return (
    <DialogSearchList
      items={items}
      placeholder="Search sessions…"
      emptyText="No sessions match your search."
      onSelect={(item) => {
        close();
        navigate(ROUTES.session(item.value));
      }}
    />
  );
}
