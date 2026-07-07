import { useRenderer } from "@opentui/react";
import { useNavigate } from "react-router";
import { runSlashCommand } from "../commands";
import {
  ConnectDialogBody,
  CustomDialogBody,
  ModelDialogBody,
  SESSION_DIALOG_WIDTH,
  SessionListBody,
  useDialog,
} from "../components/dialog";

/**
 * Shared slash-command dialog openers for screens that host the chat prompt.
 */
export function useAppDialogs() {
  const navigate = useNavigate();
  const renderer = useRenderer();
  const { open } = useDialog();

  const openModels = () => open({ title: "Select model", body: <ModelDialogBody /> });
  const openConnect = () => open({ title: "Connect provider", body: <ConnectDialogBody /> });
  const openCustom = (view?: "add" | "manage") =>
    open({ title: "Custom model", body: <CustomDialogBody initialView={view} /> });
  const openSessions = () =>
    open({ title: "Sessions", width: SESSION_DIALOG_WIDTH, body: <SessionListBody /> });

  const runCommand = (value: string) =>
    runSlashCommand(value, {
      navigate,
      exit: () => renderer.destroy(),
      openModels,
      openConnect,
      openCustom,
      openSessions,
    });

  return { openModels, openConnect, openCustom, openSessions, runCommand };
}
