import {
  addCustomModel,
  selectCustomModel,
  setCustomModelKey,
  updateCustomModel,
} from "@babalcode/engine";
import { useState } from "react";
import { useIsActiveLayer, useLayerKeyboard } from "../../services/layer";
import { colors } from "../../theme";

/** The form's fields, in tab order. API key only appears when adding. */
type FieldName = "baseURL" | "model" | "apiKey";

/** An existing model to edit in place; only its info (base URL + model id) is touched. */
type EditTarget = { id: string; baseURL: string; model: string };

type CustomModelFormProps = {
  /** Return to the previous view (also the Esc target). */
  onBack: () => void;
  /** Finished successfully — the model was added/updated. */
  onDone: () => void;
  /** When set, edit this model in place instead of adding a new one. */
  edit?: EditTarget;
};

/** A labelled bordered text field; its border lights up while focused. */
function Field({
  label,
  hint,
  focused,
  initialValue,
  placeholder,
  onInput,
  onSubmit,
}: {
  label: string;
  hint: string;
  focused: boolean;
  /** Prefill shown on mount (edit mode). Kept constant so the input stays uncontrolled. */
  initialValue?: string;
  placeholder: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <box flexDirection="column">
      <text fg={focused ? colors.text : colors.muted}>
        {label} <span fg={colors.muted}>· {hint}</span>
      </text>
      <box
        border
        borderStyle="rounded"
        borderColor={focused ? colors.accent : colors.muted}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="row"
      >
        <input
          focused={focused}
          value={initialValue}
          placeholder={placeholder}
          onInput={onInput}
          onSubmit={onSubmit}
          flexGrow={1}
          textColor={colors.text}
          cursorColor={colors.accent}
          placeholderColor={colors.muted}
        />
      </box>
    </box>
  );
}

/**
 * In-dialog custom-model form. Adds a new OpenAI-compatible model (base URL,
 * model id, optional API key) or — when `edit` is passed — updates an existing
 * one's info (base URL + model id only; its key is managed from the manage view).
 * All fields are shown together in a single dialog rather than a step-by-step
 * wizard: Tab / ↑ / ↓ move between fields, Enter advances (and saves from the
 * last field), and Esc returns to the previous view.
 *
 * Only the active field is a focused `<input>` (live cursor, native editing/paste);
 * the rest are inert. Field navigation and Esc are handled on the dialog's layer
 * *before* they can reach the focused input or the `Dialog`'s own close handler
 * (child key handlers register first), so those keys drive the form rather than
 * editing text or dismissing the whole dialog.
 */
export function CustomModelForm({ onBack, onDone, edit }: CustomModelFormProps) {
  const isActive = useIsActiveLayer();
  // API key only applies when adding; editing is info-only.
  const fields: readonly FieldName[] = edit
    ? ["baseURL", "model"]
    : ["baseURL", "model", "apiKey"];
  const lastField = fields.at(-1)!;

  const [focus, setFocus] = useState<FieldName>("baseURL");
  const [baseURL, setBaseURL] = useState(edit?.baseURL ?? "");
  const [model, setModel] = useState(edit?.model ?? "");
  const [apiKey, setApiKey] = useState("");

  const move = (delta: number) => {
    const i = fields.indexOf(focus);
    const next = fields[(i + delta + fields.length) % fields.length];
    if (next) setFocus(next);
  };

  const finish = () => {
    // Required fields: send focus to the first missing one instead of saving.
    if (!baseURL.trim()) return setFocus("baseURL");
    if (!model.trim()) return setFocus("model");

    if (edit) {
      void updateCustomModel(edit.id, { baseURL: baseURL.trim(), model: model.trim() })
        .then(onDone)
        .catch(onDone);
      return;
    }
    void addCustomModel({ baseURL: baseURL.trim(), model: model.trim() })
      .then((entry) => {
        if (apiKey.trim()) setCustomModelKey(entry.id, apiKey.trim());
        return selectCustomModel(entry.id);
      })
      .then(onDone)
      .catch(onDone);
  };

  // Esc returns to the previous view; Tab / ↑ / ↓ move between fields. Consumed so
  // they never reach the focused input or the Dialog's close handler beneath us.
  useLayerKeyboard((key) => {
    if (key.name === "escape") {
      onBack();
      return true;
    }
    if (key.name === "tab") {
      move(key.shift ? -1 : 1);
      return true;
    }
    if (key.name === "down") {
      move(1);
      return true;
    }
    if (key.name === "up") {
      move(-1);
      return true;
    }
    return false;
  });

  // Enter on a field advances to the next; from the last field it saves.
  const onFieldSubmit = () => {
    if (focus === lastField) finish();
    else move(1);
  };

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.text}>
        <b>{edit ? "Edit custom model" : "Add custom model"}</b>
      </text>

      <Field
        label="Base URL"
        hint="OpenAI-compatible, usually ends with /v1"
        focused={isActive && focus === "baseURL"}
        initialValue={edit?.baseURL}
        placeholder="http://localhost:11434/v1"
        onInput={setBaseURL}
        onSubmit={onFieldSubmit}
      />

      <Field
        label="Model id"
        hint="sent to the API"
        focused={isActive && focus === "model"}
        initialValue={edit?.model}
        placeholder="llama3.2"
        onInput={setModel}
        onSubmit={onFieldSubmit}
      />

      {!edit ? (
        <Field
          label="API key"
          hint="optional"
          focused={isActive && focus === "apiKey"}
          placeholder="sk-… or leave empty"
          onInput={setApiKey}
          onSubmit={onFieldSubmit}
        />
      ) : null}

      <text fg={colors.muted}>
        tab/↑↓ move · enter next · enter on {edit ? "Model id" : "API key"} saves · esc back
      </text>
    </box>
  );
}
