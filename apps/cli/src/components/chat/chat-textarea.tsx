import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  getMode,
  getModelDisplayLabel,
  getModelSelection,
  getNextModeId,
  listWorkspaceFiles,
} from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterSlashCommands, slashQuery } from "../../commands";
import { activeMention, rankFiles } from "../../mentions";
import { useIsActiveLayer, useLayerKeyboard } from "../../services/layer";
import { colors, modeColor as modeColorFor } from "../../theme";
import { EmptyBorder } from "../border";
import { BAR_CONTENT_PADDING } from "./chat-message";
import { FileMentionMenu } from "./file-mention-menu";
import { SlashCommandMenu } from "./slash-command-menu";

type ChatTextareaProps = {
  /**
   * Called with the raw (untrimmed) input and the active mode id when the user
   * submits. Untrimmed so the parent can tell a bare slash command from the same
   * text with trailing whitespace; the parent trims for the message path.
   */
  onSubmit?: (value: string, modeId: ModeId) => void;
  placeholder?: string;
  /**
   * The parent's intent to focus this input (e.g. no permission prompt is up).
   * Actual focus additionally requires this input's layer to be on top — that
   * part is handled internally via the layer service, so parents no longer pass
   * dialog state here.
   */
  focused?: boolean;
  /** Active mode (controlled by the parent, which owns the state). */
  modeId: ModeId;
  /** Called when Tab/Shift+Tab cycles the mode. */
  onModeChange: (modeId: ModeId) => void;
};

// Enter submits; Shift+Enter (where the terminal reports it) inserts a newline.
const KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
];

// The input auto-grows with its content (opencode-style). OpenTUI's textarea
// measure function already reports the full wrapped-line height when the height
// is left `auto`, so we don't size it ourselves — we just bound it: it starts at
// MIN_ROWS and expands one row per visual (wrapped) line up to MAX_ROWS, after
// which the textarea scrolls internally instead of pushing the layout further.
const MIN_ROWS = 2;
const MAX_ROWS = 10;

/** Most file rows shown in the `@`-mention menu before the list is capped. */
const MAX_MENTION_ROWS = 10;

/**
 * Multi-line chat input, modelled on opencode's prompt.
 *
 * The textarea is uncontrolled: we read its text from the renderable ref on
 * submit, then bump `generation` to remount it with an empty `initialValue`.
 *
 * `flexShrink={0}` keeps the fixed-height input from being squeezed to nothing
 * when it sits next to a `flexGrow` scrollback in the chat layout. Width is
 * capped by `ChatLayout`'s `CHAT_MAX_WIDTH` (or the home screen wrapper).
 *
 * Displays the active mode in the footer and cycles it with Tab/Shift+Tab, but the
 * mode is a *controlled* prop — the parent owns the state so it can also drive the
 * mode on regenerate/retry. Modes gate which tools the agent may use — see the
 * engine's `modes.ts`.
 */
export function ChatTextarea({
  onSubmit,
  placeholder = "Ask babal code anything…",
  focused = true,
  modeId,
  onModeChange,
}: ChatTextareaProps) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const [generation, setGeneration] = useState(0);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  // Whether a model is selected at all. Starts optimistic so the send gate doesn't
  // flash before the first read resolves; the effect below sets the real value.
  const [hasModel, setHasModel] = useState(true);
  // Transient footer hint, e.g. after a blocked send with no model selected.
  const [notice, setNotice] = useState<string | null>(null);

  // Slash-command autocomplete. `query` is the token after `/` (null = not a
  // command); `dismissed` hides the menu after Escape until the next keystroke.
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // `@`-file mention autocomplete. `mention` is the live token the caret sits in
  // (null = no mention); `mentionIndex` is the highlighted row; `mentionDismissed`
  // hides the menu after Escape until the next keystroke. `files` is the workspace
  // file corpus, (re)loaded lazily each time a mention opens.
  const [mention, setMention] = useState<ReturnType<typeof activeMention>>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  // Effective focus = the parent's intent *and* this input's layer being on top.
  // The layer check is what keeps the cursor from bleeding through an open dialog:
  // once a dialog stacks above, `useIsActiveLayer` flips false and we unfocus,
  // rather than relying on the parent to thread the dialog state in by hand.
  const layerActive = useIsActiveLayer();
  const isFocused = focused && layerActive;

  const commands = useMemo(
    () => (query !== null && !dismissed ? filterSlashCommands(query) : []),
    [query, dismissed],
  );
  const menuOpen = isFocused && commands.length > 0;

  const mentionFiles = useMemo(
    () => (mention && !mentionDismissed ? rankFiles(files, mention.query, MAX_MENTION_ROWS) : []),
    [mention, mentionDismissed, files],
  );
  const mentionOpen = isFocused && mentionFiles.length > 0;

  // Load the workspace file list whenever a mention opens (the caret enters a
  // fresh `@` token). Re-reading each time keeps the list current as the agent
  // edits the tree; it's a cheap in-process ripgrep, and setState bails out when
  // unchanged. A failed listing just leaves the menu empty.
  const mentionActive = mention !== null;
  useEffect(() => {
    if (!mentionActive) return;
    let cancelled = false;
    void listWorkspaceFiles()
      .then((list) => {
        if (!cancelled) setFiles(list);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mentionActive]);

  // Read the active model for the footer, re-reading whenever the input regains focus.
  // The model picker is a dialog that unfocuses this input while open (see `focused`),
  // so focus returning is our signal that a newly-chosen model may need to be reflected.
  // Reading only at mount would leave the footer stuck on the model selected earlier —
  // the config is a plain file with no change notification. A re-read is a cheap in-process
  // read, and setState bails out when the label is unchanged, so there's no flicker.
  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    void getModelSelection()
      .then((selection) => {
        if (!cancelled) {
          setHasModel(!!selection);
          // A model is now selected — clear any stale "pick a model" notice.
          if (selection) setNotice(null);
        }
        return selection ? getModelDisplayLabel(selection.provider, selection.model) : null;
      })
      .then((labels) => {
        if (cancelled) return;
        // No selection → clear the labels; the footer renders its "no model" state.
        setModelLabel(labels?.modelLabel ?? null);
        setProviderLabel(labels?.providerLabel ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setHasModel(false);
          setModelLabel(null);
          setProviderLabel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  // Read the textarea's live text on every edit to drive the autocomplete menu.
  // The textarea is uncontrolled, so this is our only view of its value; any
  // keystroke also clears an earlier Escape dismissal.
  const handleContentChange = () => {
    const ta = textareaRef.current;
    const text = ta?.plainText ?? "";
    setQuery(slashQuery(text));
    setSelectedIndex(0);
    setDismissed(false);
    // Typing clears the "pick a model" hint from an earlier blocked send.
    setNotice(null);
    // The caret drives which `@` (if any) is live — a mention only autocompletes
    // the token the caret is sitting at the end of.
    const caret = ta?.cursorOffset ?? text.length;
    setMention(activeMention(text, caret));
    setMentionIndex(0);
    setMentionDismissed(false);
  };

  // Execute the highlighted command by routing it through `onSubmit` — the parent
  // treats a leading-`/` value as a route to navigate to. Also clears the input.
  const acceptSelected = (index: number = selectedIndex) => {
    const cmd = commands[index];
    if (!cmd) return;
    onSubmit?.(cmd.command, modeId);
    setQuery(null);
    setDismissed(true);
    setGeneration((g) => g + 1);
  };

  // Replace the live `@query` token with the chosen path (kept as an `@`-mention
  // so it reads as a reference), plus a trailing space to keep typing. Mutates the
  // uncontrolled textarea in place via `replaceText` (undoable) rather than
  // remounting it, then parks the caret after the inserted token so the recomputed
  // mention closes on its own.
  const acceptMention = (index: number = mentionIndex) => {
    const path = mentionFiles[index];
    const ta = textareaRef.current;
    if (!path || !mention || !ta) return;
    const text = ta.plainText;
    const token = `@${path} `;
    const next = text.slice(0, mention.start) + token + text.slice(mention.end);
    ta.replaceText(next);
    ta.cursorOffset = mention.start + token.length;
    setMention(null);
    setMentionDismissed(true);
  };

  // Keyboard handling splits on whether the menu is open. Only the focused input
  // reacts, so the home and chat textareas don't both respond (all `useKeyboard`
  // handlers co-fire). `useKeyboard` invokes the latest closure, so `modeId`,
  // `menuOpen`, and `selectedIndex` are never stale. Returning here only skips our
  // logic — the textarea still processes the key for cursor movement/editing.
  useKeyboard((key) => {
    if (!isFocused) return;
    // The `@`-mention menu takes navigation before the slash menu and the mode
    // cycle; only one of the two menus is ever open (slash needs a leading `/`).
    if (mentionOpen) {
      if (key.name === "up") setMentionIndex((i) => Math.max(0, i - 1));
      else if (key.name === "down")
        setMentionIndex((i) => Math.min(mentionFiles.length - 1, i + 1));
      else if (key.name === "tab") acceptMention();
      else if (key.name === "escape") setMentionDismissed(true);
      return;
    }
    if (menuOpen) {
      // Menu navigation: arrows move the highlight, Tab completes, Escape dismisses.
      // (Enter is handled by the textarea's submit → `handleSubmit` below.)
      if (key.name === "up") setSelectedIndex((i) => Math.max(0, i - 1));
      else if (key.name === "down") setSelectedIndex((i) => Math.min(commands.length - 1, i + 1));
      else if (key.name === "tab") acceptSelected();
      else if (key.name === "escape") setDismissed(true);
      return;
    }
    if (key.name === "tab") onModeChange(getNextModeId(modeId, key.shift ? -1 : 1));
  });

  // Ctrl+C clears the input instead of quitting — but only when it has content,
  // and only when this input is the focused, active-layer one. Consuming the key
  // (return true) overrides the app-level quit; an empty input declines it, so a
  // second Ctrl+C falls through the stack and exits (the footer's promise). The
  // textarea is uncontrolled, so we clear by remounting it empty via `generation`.
  useLayerKeyboard((key) => {
    if (!isFocused || !key.ctrl || key.name !== "c") return;
    if ((textareaRef.current?.plainText ?? "").length === 0) return;
    setGeneration((g) => g + 1);
    setQuery(null);
    setDismissed(true);
    setMention(null);
    setMentionDismissed(true);
    return true;
  });

  const handleSubmit = () => {
    // With a menu open, Enter confirms the highlighted row instead of submitting.
    // Mention takes priority (they never co-occur, but be explicit).
    if (mentionOpen) {
      acceptMention();
      return;
    }
    if (menuOpen) {
      acceptSelected();
      return;
    }
    // Pass the raw (untrimmed) text: whether it's a bare slash command depends on
    // there being no trailing space/args, so trimming here would hide that. The
    // parent trims for the message path.
    const value = textareaRef.current?.plainText ?? "";
    if (value.trim().length === 0) return;
    // Slash commands (e.g. /model) always go through so the user can pick a model;
    // a plain message with nothing selected is blocked with an inline hint instead
    // of failing at send time in the agent.
    const isCommand = value.trim().startsWith("/");
    if (!isCommand && !hasModel) {
      setNotice("No model selected — press /model to choose one.");
      return;
    }
    onSubmit?.(value, modeId);
    setGeneration((g) => g + 1);
  };

  // const borderColor = focused ? colors.accent : colors.muted;
  const modeColor = modeColorFor(modeId);

  return (
    <box flexShrink={0} flexDirection="column" width="100%" position="relative">
      {/* Menu sits in its own bar so its left border reads as a distinct accent,
          independent of the mode-coloured border on the input below. It floats
          absolutely just above the input (`bottom="100%"`) so opening it overlays
          the content above rather than shifting the whole layout. */}
      {menuOpen && (
        <box
          position="absolute"
          left={0}
          bottom="100%"
          width="100%"
          flexDirection="row"
          zIndex={10}
        >
          <box
            border={["left"]}
            borderColor={colors.muted}
            customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
          />
          <box backgroundColor={colors.panel} paddingX={BAR_CONTENT_PADDING} flexGrow={1}>
            <SlashCommandMenu
              commands={commands}
              selectedIndex={selectedIndex}
              onHighlight={setSelectedIndex}
              onSelect={acceptSelected}
            />
          </box>
        </box>
      )}
      {/* `@`-mention file menu — same floating bar as the slash menu above; the
          two never open together (slash needs a leading `/`). */}
      {mentionOpen && (
        <box
          position="absolute"
          left={0}
          bottom="100%"
          width="100%"
          flexDirection="row"
          zIndex={10}
        >
          <box
            border={["left"]}
            borderColor={colors.muted}
            customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
          />
          <box backgroundColor={colors.panel} paddingX={BAR_CONTENT_PADDING} flexGrow={1}>
            <FileMentionMenu
              files={mentionFiles}
              selectedIndex={mentionIndex}
              onHighlight={setMentionIndex}
              onSelect={acceptMention}
            />
          </box>
        </box>
      )}
      <box flexDirection="row" width="100%">
        <box border={["left"]} borderColor={modeColor} customBorderChars={{ ...EmptyBorder, vertical: "┃" }} />
        <box
          backgroundColor={colors.panel}
          paddingX={BAR_CONTENT_PADDING}
          paddingY={1}
          flexDirection="column"
          flexGrow={1}
        >
          <textarea
            key={generation}
            ref={textareaRef}
            placeholder={placeholder}
            focused={isFocused}
            minHeight={MIN_ROWS}
            maxHeight={MAX_ROWS}
            wrapMode="word"
            textColor={colors.text}
            cursorColor={colors.accent}
            placeholderColor={colors.muted}
            keyBindings={KEY_BINDINGS}
            onContentChange={handleContentChange}
            onSubmit={handleSubmit}
          />
          <box flexDirection="row" justifyContent="space-between">
            <text>
              <span fg={modeColor}>{getMode(modeId).label}</span>
              {!hasModel ? (
                <>
                  <span fg={colors.muted}> · </span>
                  <span fg={colors.accent}>No model</span>
                  <span fg={colors.muted}> — /model to choose</span>
                </>
              ) : modelLabel && providerLabel ? (
                <>
                  <span fg={colors.muted}> · </span>
                  <span fg="#ffffff">{modelLabel}&nbsp;</span>
                  <span fg="#808080">{providerLabel}</span>
                </>
              ) : null}
            </text>
            <text fg={notice ? colors.accent : colors.muted}>{notice ?? "ctrl+c to exit"}</text>
          </box>
        </box>
      </box>
    </box>
  );
}
