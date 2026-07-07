import {
  getModelSelection,
  listConnectedModelOptions,
  selectCustomModel,
  setModelSelection,
} from "@babalcode/engine";
import type { ModelOption, ProviderId } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { colors } from "../../theme";
import { useDialog } from "./dialog-context";
import { DialogSearchList } from "./dialog-search-list";

/**
 * `/models` dialog body — pick from connected providers only.
 * Use `/connect` for built-in provider keys and `/custom` to add endpoints.
 */
export function ModelDialogBody() {
  const { close } = useDialog();
  const [current, setCurrent] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderId | null>(null);
  const [currentCustomId, setCurrentCustomId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getModelSelection(), listConnectedModelOptions()])
      .then(([selection, options]) => {
        if (cancelled) return;
        setCurrent(selection?.model ?? null);
        setCurrentProvider(selection?.provider ?? null);
        setCurrentCustomId(selection?.customModelId ?? null);
        setModelOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setCurrent(null);
          setCurrentProvider(null);
          setCurrentCustomId(null);
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

  const items = modelOptions.map((m) => {
    const isCurrent =
      m.provider === currentProvider &&
      (m.provider === "custom" ? m.id === currentCustomId : m.id === current);
    const desc = m.description ?? m.id;
    const description = isCurrent ? `${desc} · current` : desc;
    return {
      name: m.label,
      description,
      value: `${m.provider}:${m.id}`,
      section: m.section,
    };
  });

  if (loading) return <text fg={colors.muted}>Loading models…</text>;

  if (items.length === 0) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={colors.text}>
          <b>No models available</b>
        </text>
        <text fg={colors.muted}>Use /connect to add a provider API key.</text>
        <text fg={colors.muted}>Use /custom for a local or OpenAI-compatible endpoint.</text>
      </box>
    );
  }

  return (
    <DialogSearchList
      items={items}
      inlineDescription
      placeholder="Search models…"
      emptyText="No models match your search."
      onSelect={(item) => {
        const [provider, ...rest] = item.value.split(":");
        const modelId = rest.join(":");
        if (provider === "custom") {
          void selectCustomModel(modelId).then(close);
          return;
        }
        void setModelSelection(provider as ProviderId, modelId).then(close);
      }}
    />
  );
}
