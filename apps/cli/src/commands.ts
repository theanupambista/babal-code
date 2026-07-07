/**
 * Slash-command registry for the prompt autocomplete.
 *
 * A slash command is usually a route path (see `routes.ts`) — typing it and
 * submitting navigates there. A few are *actions* instead (`/clear`, `/exit`),
 * dispatched by `runSlashCommand` rather than navigated to. This list is the
 * discoverable subset shown in the autocomplete menu when the prompt begins with
 * `/`; each entry carries a one-line description. Keep it in sync with the routes
 * and actions worth surfacing to the user.
 */
import { ROUTES } from "./routes";

/** `/models` — opens the model picker dialog (connected models only). */
export const MODELS_COMMAND = "/models";

/** `/connect` — opens the provider key management dialog. */
export const CONNECT_COMMAND = "/connect";

/** `/custom` — opens the add-custom-model dialog. */
export const CUSTOM_COMMAND = "/custom";

/** `/sessions` — opens the session picker dialog. */
export const SESSIONS_COMMAND = "/sessions";

export type SlashCommand = {
  /**
   * The full command as typed, e.g. `/sessions`. Usually the route path it
   * navigates to; a few (`/sessions`, `/models`, `/clear`, `/exit`) are actions
   * handled by `runSlashCommand`.
   */
  command: string;
  /** One-line description shown beside the command in the menu. */
  description: string;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { command: SESSIONS_COMMAND, description: "Browse and resume past sessions" },
  { command: MODELS_COMMAND, description: "Switch the active model" },
  { command: CONNECT_COMMAND, description: "Connect or update a provider API key" },
  { command: CUSTOM_COMMAND, description: "Add an OpenAI-compatible endpoint" },
  { command: "/clear", description: "Clear the conversation and return home" },
  { command: "/exit", description: "Quit babal code" },
];

export type SlashCommandContext = {
  /** Router navigate — most commands are just a route path to go to. */
  navigate: (path: string) => void;
  /** Tear down the renderer and quit, restoring the terminal. Used by `/exit`. */
  exit: () => void;
  /** Open the model picker dialog (`/models`). */
  openModels: () => void;
  /** Open the provider key dialog (`/connect`). */
  openConnect: () => void;
  /** Open the custom endpoint dialog (`/custom`). */
  openCustom: (view?: "add" | "manage") => void;
  /** Open the session picker dialog (`/sessions`). */
  openSessions: () => void;
};

/**
 * If `input` is a *bare* slash command — a lone `/token` at index 0 with no
 * trailing space, arguments, or surrounding quotes (see `slashQuery`) — execute
 * it and return `true`. Otherwise return `false`, leaving the caller to submit
 * the input as ordinary text.
 */
export function runSlashCommand(input: string, ctx: SlashCommandContext): boolean {
  if (slashQuery(input) === null) return false;
  const path = input.toLowerCase();
  switch (path) {
    case "/exit":
      ctx.exit();
      return true;
    case "/clear":
      ctx.navigate(ROUTES.home);
      return true;
    case SESSIONS_COMMAND:
      ctx.openSessions();
      return true;
    case MODELS_COMMAND:
      ctx.openModels();
      return true;
    case CONNECT_COMMAND:
      ctx.openConnect();
      return true;
    case CUSTOM_COMMAND:
      ctx.openCustom("add");
      return true;
    default:
      ctx.navigate(path);
      return true;
  }
}

/**
 * If `text` is a bare slash-command query — a single `/token` with no whitespace —
 * return the lowercased token after the slash (possibly empty). Otherwise `null`.
 */
export function slashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  if (/\s/.test(text)) return null;
  return text.slice(1).toLowerCase();
}

/**
 * Commands matching `query` (the token after `/`), with prefix matches ranked
 * ahead of looser substring matches. An empty query returns everything.
 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.command.slice(1).toLowerCase().includes(q)).sort((a, b) => {
    const aPrefix = a.command.slice(1).toLowerCase().startsWith(q);
    const bPrefix = b.command.slice(1).toLowerCase().startsWith(q);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    return a.command.localeCompare(b.command);
  });
}
