import {
  clearModelSelectionForProvider,
  deleteApiKey,
  listProviderConnections,
  setApiKey,
  type ProviderConnection,
  type ProviderId,
} from "@babalcode/engine";
import { useCallback, useEffect, useState } from "react";
import { useLayerKeyboard } from "../../services/layer";
import { colors } from "../../theme";
import { MaskedInput } from "../masked-input";

type Mode = "list" | "key" | "confirmRemove";

/**
 * `/connect` dialog body — manage API keys for built-in providers.
 * ↑/↓ move · enter/k set or update key · x remove keychain key · esc close
 */
export function ConnectDialogBody() {
  const [providers, setProviders] = useState<ProviderConnection[] | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [target, setTarget] = useState<ProviderConnection | null>(null);

  const refresh = useCallback(async () => {
    const list = await listProviderConnections();
    setProviders(list);
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, list.length - 1))));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current =
    providers && providers.length > 0 ? (providers[Math.min(index, providers.length - 1)] ?? null) : null;

  const openKey = (provider: ProviderConnection) => {
    setTarget(provider);
    setMode("key");
  };

  useLayerKeyboard((key) => {
    if (mode === "key") {
      if (key.name === "escape") {
        setMode("list");
        setTarget(null);
        return true;
      }
      return false;
    }

    if (mode === "confirmRemove") {
      if (key.name === "y" || key.name === "return" || key.name === "enter") {
        if (target) {
          const providerId = target.id as ProviderId;
          deleteApiKey(providerId);
          void clearModelSelectionForProvider(providerId)
            .then(() => refresh())
            .finally(() => {
            setMode("list");
            setTarget(null);
          });
        } else {
          setMode("list");
        }
        return true;
      }
      if (key.name === "n" || key.name === "escape") {
        setMode("list");
        setTarget(null);
        return true;
      }
      return true;
    }

    if (key.name === "up" && providers && providers.length > 0) {
      setIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down" && providers && providers.length > 0) {
      setIndex((i) => Math.min(providers.length - 1, i + 1));
      return true;
    }
    if (!current) return false;
    if (key.name === "return" || key.name === "enter" || key.name === "k") {
      openKey(current);
      return true;
    }
    if (key.name === "x" && current.connected && !current.fromEnv) {
      setTarget(current);
      setMode("confirmRemove");
      return true;
    }
    return false;
  });

  if (providers === null) {
    return <text fg={colors.muted}>Loading providers…</text>;
  }

  if (mode === "key" && target) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={colors.text}>
          <b>{target.connected ? "Update" : "Set"} {target.label} API key</b>
        </text>
        <text fg={colors.muted}>
          Stored in your OS keychain, never on disk · env: {target.envVar}
        </text>
        <MaskedInput
          placeholder="Paste your API key…"
          onCancel={() => {
            setMode("list");
            setTarget(null);
          }}
          onSubmit={(key) => {
            setApiKey(target.id as ProviderId, key);
            void refresh().finally(() => {
              setMode("list");
              setTarget(null);
            });
          }}
        />
      </box>
    );
  }

  const selectedIndex = Math.min(index, Math.max(0, providers.length - 1));

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.muted}>One key unlocks every model from that provider.</text>
      <box flexDirection="column">
        {providers.map((p, i) => {
          const selected = i === selectedIndex;
          const fg = selected ? colors.background : colors.text;
          const sub = selected ? colors.background : colors.muted;
          const status = p.fromEnv ? "env" : p.connected ? "connected" : "not connected";
          return (
            <box
              key={p.id}
              flexDirection="row"
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selected ? colors.accent : undefined}
            >
              <text wrapMode="none" fg={fg}>
                {p.label}
              </text>
              <text wrapMode="none" fg={sub}>
                {`  ${p.modelCount} models · ${status}`}
              </text>
            </box>
          );
        })}
      </box>
      {mode === "confirmRemove" && target ? (
        <text fg={colors.accent}>
          Remove {target.label} key from keychain? y to confirm · n to cancel
        </text>
      ) : (
        <text fg={colors.muted}>
          ↑/↓ move · enter/k set key · x remove keychain key · esc close
        </text>
      )}
    </box>
  );
}
