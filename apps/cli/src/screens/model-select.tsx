import { DEFAULT_PROVIDER, getModelSelection, PROVIDERS, setModelSelection } from "@babalcode/engine";
import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { colors } from "../theme";

/**
 * `/model` — pick the active model from the current provider's curated catalog.
 * The choice persists as the global default in `~/.babalcode/config.json` and takes
 * effect on the next message. Mirrors the `<select>` usage in `session-list.tsx`.
 */
export function ModelSelect() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getModelSelection()
      .then((selection) => {
        if (!cancelled) setCurrent(selection.model);
      })
      .catch(() => {
        if (!cancelled) setCurrent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === "escape") navigate(-1);
  });

  const provider = PROVIDERS[DEFAULT_PROVIDER];
  const options = provider.models.map((m) => ({
    name: m.label,
    description: m.id === current ? `${m.id} · current` : m.id,
    value: m.id,
  }));

  return (
    <box flexGrow={1} flexDirection="column" padding={1} gap={1}>
      <text fg={colors.accent}>Select a model · {provider.label}</text>
      <select
        flexGrow={1}
        focused
        options={options}
        showScrollIndicator
        selectedBackgroundColor={colors.accent}
        selectedTextColor="#000000"
        onSelect={(_index, option) => {
          if (!option) return;
          void setModelSelection(DEFAULT_PROVIDER, option.value as string).then(() => navigate(-1));
        }}
      />
      <text fg={colors.muted}>↑/↓ to navigate · enter to select · esc to go back</text>
    </box>
  );
}
