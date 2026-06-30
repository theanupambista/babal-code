import { useEffect, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useNavigate } from "react-router";
import { client } from "../lib/client";
import { ROUTES } from "../routes";
import { colors } from "../theme";

type Health =
  | { state: "loading" }
  | { state: "ok"; status: string; uptime: number }
  | { state: "error"; message: string };

/** Minimal settings screen. Shows server health on mount. Press esc to return home. */
export function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<Health>({ state: "loading" });

  useKeyboard((key) => {
    if (key.name === "escape") navigate(ROUTES.home);
  });

  useEffect(() => {
    let cancelled = false;

    client.health
      .$get()
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHealth({ state: "ok", status: data.status, uptime: data.uptime });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth({ state: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text fg={colors.accent}>Settings</text>
      <box flexDirection="column" alignItems="center">
        <text fg={colors.text}>Theme: dark</text>
        <text fg={colors.text}>Accent: {colors.accent}</text>
        {health.state === "loading" && <text fg={colors.muted}>Server: checking…</text>}
        {health.state === "ok" && (
          <text fg={colors.text}>
            Server: {health.status} (up {Math.floor(health.uptime)}s)
          </text>
        )}
        {health.state === "error" && <text fg={colors.muted}>Server: unreachable ({health.message})</text>}
      </box>
      <text fg={colors.muted}>esc to go back</text>
    </box>
  );
}
