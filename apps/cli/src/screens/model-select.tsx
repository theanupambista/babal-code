import {
  CUSTOM_SETUP_MODEL_ID,
  getModelSelection,
  listModelOptions,
  setModelSelection,
} from "@babalcode/engine";
import type { ModelOption, ProviderId } from "@babalcode/engine";
import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../routes";
import { colors } from "../theme";

/**
 * `/model` — pick the active model from every provider's curated catalog. The choice
 * persists as the global default (provider + model) in `~/.babalcode/config.json` and
 * takes effect on the next message. Mirrors the `<select>` usage in `session-list.tsx`.
 */
export function ModelSelect() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderId | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getModelSelection(), listModelOptions()])
      .then(([selection, options]) => {
        if (cancelled) return;
        setCurrent(selection.model);
        setCurrentProvider(selection.provider);
        setModelOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setCurrent(null);
          setCurrentProvider(null);
          setModelOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  const options = modelOptions.map((m) => {
    const isCurrent = m.provider === currentProvider && m.id === current;
    return {
      name: m.label,
      description: isCurrent ? `${m.id} · current` : m.id,
      value: `${m.provider}:${m.id}`,
    };
  });

  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <text fg={colors.accent}>Select a model</text>
      {loading ? (
        <text fg={colors.muted}>Loading models…</text>
      ) : (
        <select
          flexGrow={1}
          focused
          options={options}
          showScrollIndicator
          selectedBackgroundColor={colors.accent}
          selectedTextColor="#000000"
          onSelect={(_index, option) => {
            if (!option) return;
            const [provider, ...rest] = (option.value as string).split(":");
            const modelId = rest.join(":");
            if (provider === "custom" && modelId === CUSTOM_SETUP_MODEL_ID) {
              navigate(ROUTES.custom);
              return;
            }
            void setModelSelection(provider as ProviderId, modelId).then(() => navigate(-1));
          }}
        />
      )}
      <text fg={colors.muted}>↑/↓ to navigate · enter to select · esc to go back</text>
    </box>
  );
}
