import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { getMode, getModelDisplayLabel, getModelSelection, getNextModeId } from "@babalcode/engine";
import type { ModeId } from "@babalcode/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterSlashCommands, slashQuery } from "../../commands";
import { colors, modeColor as modeColorFor } from "../../theme";
import { EmptyBorder } from "../border";
import { BAR_CONTENT_PADDING } from "./chat-message";
import { SlashCommandMenu } from "./slash-command-menu";

type ChatTextareaProps = {
  /**
   * Called with the raw (untrimmed) input and the active mode id when the user
   * submits. Untrimmed so the parent can tell a bare slash command from the same
   * text with trailing whitespace; the parent trims for the message path.
   */
  onSubmit?: (value: string, modeId: ModeId) => void;
  placeholder?: string;
  /** Whether the textarea owns keyboard focus. */
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

  // Slash-command autocomplete. `query` is the token after `/` (null = not a
  // command); `dismissed` hides the menu after Escape until the next keystroke.
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const commands = useMemo(
    () => (query !== null && !dismissed ? filterSlashCommands(query) : []),
    [query, dismissed],
  );
  const menuOpen = focused && commands.length > 0;

  useEffect(() => {
    let cancelled = false;
    void getModelSelection()
      .then(({ provider, model }) => getModelDisplayLabel(provider, model))
      .then(({ modelLabel, providerLabel }) => {
        if (cancelled) return;
        setModelLabel(modelLabel);
        setProviderLabel(providerLabel);
      })
      .catch(() => {
        if (!cancelled) {
          setModelLabel(null);
          setProviderLabel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read the textarea's live text on every edit to drive the autocomplete menu.
  // The textarea is uncontrolled, so this is our only view of its value; any
  // keystroke also clears an earlier Escape dismissal.
  const handleContentChange = () => {
    const text = textareaRef.current?.plainText ?? "";
    setQuery(slashQuery(text));
    setSelectedIndex(0);
    setDismissed(false);
  };

  // Execute the highlighted command by routing it through `onSubmit` — the parent
  // treats a leading-`/` value as a route to navigate to. Also clears the input.
  const acceptSelected = () => {
    const cmd = commands[selectedIndex];
    if (!cmd) return;
    onSubmit?.(cmd.command, modeId);
    setQuery(null);
    setDismissed(true);
    setGeneration((g) => g + 1);
  };

  // Keyboard handling splits on whether the menu is open. Only the focused input
  // reacts, so the home and chat textareas don't both respond (all `useKeyboard`
  // handlers co-fire). `useKeyboard` invokes the latest closure, so `modeId`,
  // `menuOpen`, and `selectedIndex` are never stale. Returning here only skips our
  // logic — the textarea still processes the key for cursor movement/editing.
  useKeyboard((key) => {
    if (!focused) return;
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

  const handleSubmit = () => {
    // With the menu open, Enter confirms the highlighted command instead of
    // submitting the raw text.
    if (menuOpen) {
      acceptSelected();
      return;
    }
    // Pass the raw (untrimmed) text: whether it's a bare slash command depends on
    // there being no trailing space/args, so trimming here would hide that. The
    // parent trims for the message path.
    const value = textareaRef.current?.plainText ?? "";
    if (value.trim().length === 0) return;
    onSubmit?.(value, modeId);
    setGeneration((g) => g + 1);
  };

  // const borderColor = focused ? colors.accent : colors.muted;
  const modeColor = modeColorFor(modeId);

  return (
    <box flexShrink={0} flexDirection="column" width="100%">
      {/* Menu sits in its own bar so its left border reads as a distinct accent,
          independent of the mode-coloured border on the input below. */}
      {menuOpen && (
        <box flexDirection="row" width="100%">
          <box
            border={["left"]}
            borderColor={colors.muted}
            customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
          />
          <box backgroundColor={colors.panel} paddingX={BAR_CONTENT_PADDING} flexGrow={1}>
            <SlashCommandMenu commands={commands} selectedIndex={selectedIndex} />
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
            focused={focused}
            height={2}
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
              {modelLabel && providerLabel ? (
                <>
                  <span fg={colors.muted}> · </span>
                  <span fg="#ffffff">{modelLabel}&nbsp;</span>
                  <span fg="#808080">{providerLabel}</span>
                </>
              ) : null}
            </text>
            <text fg={colors.muted}>ctrl+c to exit</text>
          </box>
        </box>
      </box>
    </box>
  );
}
