import {
  CUSTOM_SETUP_MODEL_ID,
  MANAGE_CUSTOM_MODELS_ID,
  getModelSelection,
  listModelOptions,
  selectCustomModel,
  setModelSelection,
} from "@babalcode/engine";
import type { CustomModel, ModelOption, ProviderId } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { colors } from "../../theme";
import { CustomModelForm } from "./custom-model-form";
import { useDialog } from "./dialog-context";
import { DialogSearchList } from "./dialog-search-list";
import { ManageModelsBody } from "./manage-models-body";

/**
 * Body slot for the "Select model" dialog: the provider catalog as a scrollable
 * list. Choosing a model persists it as the global default and closes the dialog.
 * "Set up custom endpoint" swaps the body for an inline add-model form (no page
 * navigation); "Manage custom models" routes to the management screen.
 *
 * Extracted from the former `/model` screen so the picker lives in a dialog over
 * the current screen instead of a full-page navigation. The dialog chrome (title,
 * `esc`) is owned by `Dialog`; this only renders the list.
 */
type ModelDialogBodyProps = {
  /** Which sub-view to open on first render. Defaults to the model list. */
  initialView?: "list" | "add";
};

export function ModelDialogBody({ initialView = "list" }: ModelDialogBodyProps) {
  const { close } = useDialog();
  const [view, setView] = useState<"list" | "add" | "manage" | "edit">(initialView);
  const [editTarget, setEditTarget] = useState<CustomModel | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderId | null>(null);
  const [currentCustomId, setCurrentCustomId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getModelSelection(), listModelOptions()])
      .then(([selection, options]) => {
        if (cancelled) return;
        setCurrent(selection.model);
        setCurrentProvider(selection.provider);
        setCurrentCustomId(selection.customModelId ?? null);
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
    return {
      name: m.label,
      description: isCurrent ? `${desc} · current` : desc,
      value: `${m.provider}:${m.id}`,
      section: m.section,
    };
  });

  if (view === "add") {
    return <CustomModelForm onBack={() => setView("list")} onDone={close} />;
  }

  if (view === "manage") {
    return (
      <ManageModelsBody
        onBack={() => setView("list")}
        onEdit={(m) => {
          setEditTarget(m);
          setView("edit");
        }}
        onActivated={close}
      />
    );
  }

  if (view === "edit" && editTarget) {
    return (
      <CustomModelForm
        edit={{ id: editTarget.id, baseURL: editTarget.baseURL, model: editTarget.model }}
        onBack={() => setView("manage")}
        onDone={() => setView("manage")}
      />
    );
  }

  if (loading) return <text fg={colors.muted}>Loading models…</text>;

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
          if (modelId === CUSTOM_SETUP_MODEL_ID) {
            setView("add");
            return;
          }
          if (modelId === MANAGE_CUSTOM_MODELS_ID) {
            setView("manage");
            return;
          }
          void selectCustomModel(modelId).then(close);
          return;
        }
        void setModelSelection(provider as ProviderId, modelId).then(close);
      }}
    />
  );
}
