import {
  CUSTOM_SETUP_MODEL_ID,
  getModelSelection,
  listModelOptions,
  setModelSelection,
} from "@babalcode/engine";
import type { ModelOption, ProviderId } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../../routes";
import { colors } from "../../theme";
import { useDialog } from "./dialog-context";
import { DialogSearchList } from "./dialog-search-list";

/**
 * Body slot for the "Select model" dialog: the provider catalog as a scrollable
 * list. Choosing a model persists it as the global default and closes the dialog;
 * choosing "Set up custom endpoint" closes and routes to `/custom`.
 *
 * Extracted from the former `/model` screen so the picker lives in a dialog over
 * the current screen instead of a full-page navigation. The dialog chrome (title,
 * `esc`) is owned by `Dialog`; this only renders the list.
 */
export function ModelDialogBody() {
  const navigate = useNavigate();
  const { close } = useDialog();
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

  const items = modelOptions.map((m) => {
    const isCurrent = m.provider === currentProvider && m.id === current;
    return {
      name: m.label,
      description: isCurrent ? `${m.id} · current` : m.id,
      value: `${m.provider}:${m.id}`,
    };
  });

  if (loading) return <text fg={colors.muted}>Loading models…</text>;

  return (
    <DialogSearchList
      items={items}
      placeholder="Search models…"
      emptyText="No models match your search."
      onSelect={(item) => {
        const [provider, ...rest] = item.value.split(":");
        const modelId = rest.join(":");
        if (provider === "custom" && modelId === CUSTOM_SETUP_MODEL_ID) {
          close();
          navigate(ROUTES.custom);
          return;
        }
        void setModelSelection(provider as ProviderId, modelId).then(close);
      }}
    />
  );
}
