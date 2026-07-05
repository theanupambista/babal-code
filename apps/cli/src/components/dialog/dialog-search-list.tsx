import { useEffect, useMemo, useState } from "react";
import { useIsActiveLayer, useLayerKeyboard } from "../../services/layer";
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
 * The search box is a *real* focused `<input>`, so it renders a live cursor and
 * reads as focused — the input owns typing, backspace and paste natively. The
 * `<select>` beneath stays unfocused and is driven by a controlled
 * `selectedIndex`: a focused select would swallow `j`/`k` (and the arrows) as
 * navigation and starve the query, so we keep it inert and move the highlight
 * ourselves. ↑/↓ are handled on the dialog's layer (and consumed, so they never
 * reach the input's cursor); Enter arrives at the input as a submit; Esc is left
 * for the surrounding `Dialog`.
 */
export function DialogSearchList({
  items,
  onSelect,
  placeholder = "Type to search…",
  emptyText = "No matches.",
  listHeight = DEFAULT_LIST_HEIGHT,
}: DialogSearchListProps) {
  // Focus the input only while this dialog is the active layer — otherwise a
  // dialog stacked on top would leave two live cursors.
  const isActive = useIsActiveLayer();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);

  // Keep the highlight in range as the filtered set shrinks/grows.
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);
  useEffect(() => {
    if (clampedIndex !== selectedIndex) setSelectedIndex(clampedIndex);
  }, [clampedIndex, selectedIndex]);

  const confirm = () => {
    const item = filtered[clampedIndex];
    if (item) onSelect(item);
  };

  // ↑/↓ scroll the unfocused list. Consuming them (return true) keeps them off
  // the focused input, whose single line has no use for them anyway. Everything
  // else — printable keys, backspace, paste, Enter — falls through to the input.
  useLayerKeyboard((key) => {
    if (key.name === "up") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down") {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
      return true;
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      {/* Search box — a real focused input, so it shows a live cursor. */}
      <box
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="row"
      >
        <input
          focused={isActive}
          placeholder={placeholder}
          onInput={(value: string) => {
            setQuery(value);
            setSelectedIndex(0);
          }}
          onSubmit={confirm}
          flexGrow={1}
          textColor={colors.text}
          cursorColor={colors.accent}
          placeholderColor={colors.muted}
        />
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
