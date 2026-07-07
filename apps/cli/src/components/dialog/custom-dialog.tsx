import type { CustomModel } from "@babalcode/engine";
import { useState } from "react";
import { CustomModelForm } from "./custom-model-form";
import { useDialog } from "./dialog-context";
import { ManageModelsBody } from "./manage-models-body";

type CustomDialogView = "add" | "manage" | "edit";

type CustomDialogBodyProps = {
  /** Which sub-view to open on first render. Defaults to the add form. */
  initialView?: "add" | "manage";
};

/**
 * `/custom` dialog body — add OpenAI-compatible endpoints or manage existing ones.
 */
export function CustomDialogBody({ initialView = "add" }: CustomDialogBodyProps) {
  const { close } = useDialog();
  const [view, setView] = useState<CustomDialogView>(initialView);
  const [editTarget, setEditTarget] = useState<CustomModel | null>(null);

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

  if (view === "manage") {
    return (
      <ManageModelsBody
        onBack={() => setView("add")}
        onEdit={(m) => {
          setEditTarget(m);
          setView("edit");
        }}
        onActivated={close}
      />
    );
  }

  return (
    <CustomModelForm
      onBack={close}
      onDone={close}
      onManage={() => setView("manage")}
    />
  );
}
