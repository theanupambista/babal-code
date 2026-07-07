import {
  type CustomModel,
  deleteCustomModel,
  deleteCustomModelKey,
  getModelSelection,
  hasCustomModelKey,
  listCustomModels,
  selectCustomModel,
  setCustomModelKey,
} from "@babalcode/engine";
import { useCallback, useEffect, useState } from "react";
import { useLayerKeyboard } from "../../services/layer";
import { colors } from "../../theme";
import { MaskedInput } from "../masked-input";

/** What the view is doing: browsing the list, editing a key, or confirming a delete. */
type Mode = "list" | "key" | "confirmDelete";

type ManageModelsBodyProps = {
  /** Return to the model list (Esc target). */
  onBack: () => void;
  /** Edit a model's info — swaps the dialog to the edit form. */
  onEdit: (model: CustomModel) => void;
  /** A model was activated — close the dialog. */
  onActivated: () => void;
};

/**
 * "Manage custom models" as a model-picker dialog view (not a separate screen).
 * ↑/↓ move the highlight; Enter activates a model (and closes the dialog), `e`
 * edits its info, `k` sets or clears its API key, `d` deletes it, Esc returns to
 * the model list. Keyboard is scoped to the dialog's layer so it goes inert
 * behind anything stacked in front, and the key field is a focused input only
 * while this dialog is on top.
 */
export function ManageModelsBody({ onBack, onEdit, onActivated }: ManageModelsBodyProps) {
  const [models, setModels] = useState<CustomModel[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyed, setKeyed] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("list");

  const refresh = useCallback(async () => {
    const [list, selection] = await Promise.all([listCustomModels(), getModelSelection()]);
    setModels(list);
    setActiveId(selection?.provider === "custom" ? selection.customModelId ?? null : null);
    setKeyed(new Set(list.filter((m) => hasCustomModelKey(m.id)).map((m) => m.id)));
    setIndex((i) => Math.max(0, Math.min(i, list.length - 1)));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current: CustomModel | null =
    models && models.length > 0 ? (models[Math.min(index, models.length - 1)] ?? null) : null;

  useLayerKeyboard((key) => {
    if (mode === "key") {
      // MaskedInput owns typing; only intercept Esc so the whole dialog doesn't close.
      if (key.name === "escape") {
        setMode("list");
        return true;
      }
      return false;
    }

    if (mode === "confirmDelete") {
      if (key.name === "y" || key.name === "return" || key.name === "enter") {
        if (!current) {
          setMode("list");
          return true;
        }
        const id = current.id;
        void deleteCustomModel(id)
          .then(() => {
            deleteCustomModelKey(id);
            return refresh();
          })
          .finally(() => setMode("list"));
        return true;
      }
      if (key.name === "n" || key.name === "escape") {
        setMode("list");
        return true;
      }
      return true; // swallow everything else while confirming
    }

    // list mode
    if (key.name === "escape") {
      onBack();
      return true;
    }
    if (!models || models.length === 0) return false;
    if (key.name === "up") {
      setIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down") {
      setIndex((i) => Math.min(models.length - 1, i + 1));
      return true;
    }
    if (!current) return false;
    if (key.name === "return" || key.name === "enter") {
      void selectCustomModel(current.id).then(onActivated);
      return true;
    }
    if (key.name === "e") {
      onEdit(current);
      return true;
    }
    if (key.name === "k") {
      setMode("key");
      return true;
    }
    if (key.name === "d") {
      setMode("confirmDelete");
      return true;
    }
    return false;
  });

  if (models === null) {
    return <text fg={colors.muted}>Loading…</text>;
  }

  if (models.length === 0) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={colors.text}>
          <b>Custom models</b>
        </text>
        <text fg={colors.muted}>No custom models yet — add one from the model picker.</text>
        <text fg={colors.muted}>esc to go back</text>
      </box>
    );
  }

  const selectedIndex = Math.min(index, models.length - 1);

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.text}>
        <b>Custom models</b>
      </text>
      <box flexDirection="column">
        {models.map((m, i) => {
          const selected = i === selectedIndex;
          const active = m.id === activeId;
          const fg = selected ? colors.background : colors.text;
          const sub = selected ? colors.background : colors.muted;
          return (
            <box
              key={m.id}
              flexDirection="row"
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={selected ? colors.accent : undefined}
            >
              <text wrapMode="none" fg={fg}>
                {`${active ? "● " : "  "}${m.label ?? m.model}`}
              </text>
              <text wrapMode="none" fg={sub}>
                {`  ${m.model} · ${keyed.has(m.id) ? "key set" : "no key"}`}
              </text>
            </box>
          );
        })}
      </box>

      {mode === "key" && current ? (
        <box flexDirection="column" gap={1}>
          <text fg={colors.muted}>
            New API key for {current.label ?? current.model} · empty to remove
          </text>
          <box>
            <MaskedInput
              allowEmpty
              placeholder="sk-… or leave empty to remove"
              onCancel={() => setMode("list")}
              onSubmit={(value) => {
                const id = current.id;
                if (value.trim()) setCustomModelKey(id, value.trim());
                else deleteCustomModelKey(id);
                void refresh().finally(() => setMode("list"));
              }}
            />
          </box>
        </box>
      ) : mode === "confirmDelete" && current ? (
        <text fg={colors.accent}>
          Delete “{current.label ?? current.model}”? y to confirm · n to cancel
        </text>
      ) : (
        <text fg={colors.muted}>↑/↓ move · enter activate · e edit · k key · d delete</text>
      )}
    </box>
  );
}
