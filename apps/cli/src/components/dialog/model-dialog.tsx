import {
  CUSTOM_SETUP_MODEL_ID,
  MANAGE_CUSTOM_MODELS_ID,
  PROVIDERS,
  getModelSelection,
  hasProviderAuth,
  listModelOptions,
  selectCustomModel,
  setApiKey,
  setModelSelection,
} from "@babalcode/engine";
import type { CustomModel, ModelOption, ProviderId } from "@babalcode/engine";
import { useEffect, useState } from "react";
import { useLayerKeyboard } from "../../services/layer";
import { colors } from "../../theme";
import { MaskedInput } from "../masked-input";
import { CustomModelForm } from "./custom-model-form";
import { useDialog } from "./dialog-context";
import { DialogSearchList } from "./dialog-search-list";
import { ManageModelsBody } from "./manage-models-body";

/**
 * Inline "enter the provider's API key" step. Shown when the user selects a
 * built-in model whose provider has no resolved key: rather than persisting a
 * selection that would fail at send time, we collect the key here, store it, and
 * only then activate the model. Esc is consumed on this layer so it returns to the
 * list instead of closing the whole dialog.
 */
function ProviderKeyPrompt({
  provider,
  model,
  onBack,
  onDone,
}: {
  provider: ProviderId;
  model: string;
  /** Return to the model list (Esc target). */
  onBack: () => void;
  /** Key stored and model activated — close the dialog. */
  onDone: () => void;
}) {
  useLayerKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
      return true;
    }
    return false;
  });

  const info = PROVIDERS[provider];
  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.text}>
        <b>Set your {info.label} API key</b>
      </text>
      <text fg={colors.muted}>Stored in your OS keychain, never on disk · env: {info.envVar}</text>
      <MaskedInput
        placeholder="Paste your API key…"
        onCancel={onBack}
        onSubmit={(key) => {
          setApiKey(provider, key);
          void setModelSelection(provider, model).then(onDone);
        }}
      />
    </box>
  );
}

/**
 * Body slot for the "Select model" dialog: the provider catalog as a scrollable
 * list. Choosing a model persists it as the global default and closes the dialog.
 * Selecting a built-in model whose provider has no key yet drops into an inline
 * key prompt (no page navigation) and activates the model once the key is entered.
 * "Set up custom endpoint" swaps the body for an inline add-model form; "Manage
 * custom models" routes to the management screen.
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
  const [view, setView] = useState<"list" | "add" | "manage" | "edit" | "providerKey">(initialView);
  const [editTarget, setEditTarget] = useState<CustomModel | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderId | null>(null);
  const [currentCustomId, setCurrentCustomId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  // Which built-in providers already have a usable key (env or keychain). Locked
  // providers are still shown, just flagged and routed through the key prompt.
  const [authedProviders, setAuthedProviders] = useState<Set<ProviderId>>(new Set());
  // The built-in model awaiting a key, once the user picks a locked provider.
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const builtInIds = (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => id !== "custom");
    void Promise.all([
      getModelSelection(),
      listModelOptions(),
      Promise.all(builtInIds.map((id) => hasProviderAuth(id).then((ok) => [id, ok] as const))),
    ])
      .then(([selection, options, authPairs]) => {
        if (cancelled) return;
        // Selection is null when nothing is chosen yet — leave "current" unset so
        // no row is marked active.
        setCurrent(selection?.model ?? null);
        setCurrentProvider(selection?.provider ?? null);
        setCurrentCustomId(selection?.customModelId ?? null);
        setModelOptions(options);
        setAuthedProviders(new Set(authPairs.filter(([, ok]) => ok).map(([id]) => id)));
      })
      .catch(() => {
        if (!cancelled) {
          setCurrent(null);
          setCurrentProvider(null);
          setCurrentCustomId(null);
          setModelOptions([]);
          setAuthedProviders(new Set());
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
    // Built-in providers without a resolved key are shown but flagged; custom
    // models manage their own keys in the manage view, so they're never flagged here.
    const locked = m.provider !== "custom" && !authedProviders.has(m.provider);
    const desc = m.description ?? m.id;
    const description = isCurrent ? `${desc} · current` : locked ? `${desc} · needs key` : desc;
    return {
      name: m.label,
      description,
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
        edit={{
          id: editTarget.id,
          label: editTarget.label,
          baseURL: editTarget.baseURL,
          model: editTarget.model,
        }}
        onBack={() => setView("manage")}
        onDone={() => setView("manage")}
      />
    );
  }

  if (view === "providerKey" && pendingProvider && pendingModel) {
    return (
      <ProviderKeyPrompt
        provider={pendingProvider}
        model={pendingModel}
        onBack={() => setView("list")}
        onDone={close}
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
        // Built-in provider with no key yet: collect it inline, then activate.
        // Otherwise activate straight away (selecting a keyed model is one act).
        const providerId = provider as ProviderId;
        if (!authedProviders.has(providerId)) {
          setPendingProvider(providerId);
          setPendingModel(modelId);
          setView("providerKey");
          return;
        }
        void setModelSelection(providerId, modelId).then(close);
      }}
    />
  );
}
