import { decodePasteBytes, stripAnsiSequences, type PasteEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { colors } from "../../theme";

/** One row of the list. Mirrors OpenTUI's `SelectOption`, with a typed `value`. */
export type SearchListItem = {
  /** Primary display text. */
  name: string;
  /** Secondary text shown under the name. */
  description?: string;
  /** Opaque value handed back to `onSelect`. */
  value: string;
};

type DialogSearchListProps = {
  /** The full, unfiltered list of rows. */
  items: SearchListItem[];
  /** Called with the chosen row when the user presses Enter. */
  onSelect: (item: SearchListItem) => void;
  /** Placeholder shown in the search box while empty. */
  placeholder?: string;
  /** Message shown when the query matches nothing. */
  emptyText?: string;
  /** Visible rows before the list scrolls internally. */
  listHeight?: number;
};

/** Visible rows in the list before it scrolls internally. */
const DEFAULT_LIST_HEIGHT = 12;

/** Case-insensitive substring match against a row's name and description. */
function matches(item: SearchListItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.name} ${item.description ?? ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * A search box over a scrollable list — the default body layout for pick-one
 * dialogs. Typing filters `items` by a case-insensitive substring match on the
 * name and description; ↑/↓ move the highlight and Enter confirms.
 *
 * The `<select>` is deliberately left unfocused and driven by a controlled
 * `selectedIndex`: that frees every printable key (including `j`/`k`, which the
 * focused select would otherwise swallow as navigation) for the search query,
 * while `selectedIndex` still scrolls the list. Keeps the same manual keyboard
 * model as `TextInput`, so paste and backspace behave consistently. Esc is left
 * for the surrounding `Dialog` to handle.
 */
export function DialogSearchList({
  items,
  onSelect,
  placeholder = "Type to search…",
  emptyText = "No matches.",
  listHeight = DEFAULT_LIST_HEIGHT,
}: DialogSearchListProps) {
  const renderer = useRenderer();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);

  // Keep the highlight in range as the filtered set shrinks/grows.
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);
  useEffect(() => {
    if (clampedIndex !== selectedIndex) setSelectedIndex(clampedIndex);
  }, [clampedIndex, selectedIndex]);

  useKeyboard((key) => {
    if (key.name === "escape") return; // Dialog owns dismissal.
    if (key.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.name === "down") {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      const item = filtered[clampedIndex];
      if (item) onSelect(item);
      return;
    }
    if (key.name === "backspace") {
      setQuery((q) => q.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    if (!key.ctrl && !key.meta && key.sequence.length === 1 && key.sequence >= " ") {
      setQuery((q) => q + key.sequence);
      setSelectedIndex(0);
    }
  });

  useEffect(() => {
    const handlePaste = (event: PasteEvent) => {
      const text = stripAnsiSequences(decodePasteBytes(event.bytes)).replace(/[\r\n]+/g, "");
      if (text) {
        setQuery((q) => q + text);
        setSelectedIndex(0);
      }
    };
    renderer.keyInput.on("paste", handlePaste);
    return () => {
      renderer.keyInput.off("paste", handlePaste);
    };
  }, [renderer]);

  const isEmpty = query.length === 0;

  return (
    <box flexDirection="column" gap={1}>
      {/* Search box — a bordered text display, matching `TextInput`'s look. */}
      <box border borderStyle="rounded" borderColor={colors.accent} paddingLeft={1} paddingRight={1}>
        <text fg={isEmpty ? colors.muted : colors.text}>{isEmpty ? placeholder : query}</text>
      </box>

      {filtered.length === 0 ? (
        <text fg={colors.muted}>{emptyText}</text>
      ) : (
        <select
          height={listHeight}
          options={filtered.map((item) => ({
            name: item.name,
            description: item.description ?? "",
            value: item.value,
          }))}
          selectedIndex={clampedIndex}
          showScrollIndicator
          selectedBackgroundColor={colors.accent}
          selectedTextColor="#000000"
        />
      )}

      <text fg={colors.muted}>type to search · ↑/↓ to navigate · enter to select · esc to close</text>
    </box>
  );
}
