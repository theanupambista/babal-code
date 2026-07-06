import type { ScrollBoxRenderable } from "@opentui/core";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  /**
   * Optional section heading. Consecutive items sharing a section render under a
   * single heading; a heading only appears when the section has visible matches.
   */
  section?: string;
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
  /**
   * Render each row on a single line (name, then a muted description inline)
   * instead of stacking the description under the name. Defaults to stacked.
   */
  inlineDescription?: boolean;
};

/** Visible lines in the list before it scrolls internally. */
const DEFAULT_LIST_HEIGHT = 12;

/** Case-insensitive substring match against a row's name and description. */
function matches(item: SearchListItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.name} ${item.description ?? ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** Stable id for a row so the scrollbox can scroll it into view by index. */
function rowId(index: number): string {
  return `dialog-search-row-${index}`;
}

/**
 * A search box over a scrollable list — the default body layout for pick-one
 * dialogs. Typing filters `items` by a case-insensitive substring match on the
 * name and description; ↑/↓ move the highlight and Enter confirms. The mouse
 * works too: hovering a row highlights it and clicking selects it (mirroring the
 * slash-command menu).
 *
 * The search box is a *real* focused `<input>`, so it renders a live cursor and
 * reads as focused — the input owns typing, backspace and paste natively. The
 * list is a `<scrollbox>` of plain rows (not a focused `<select>`, which would
 * swallow `j`/`k` and the arrows as navigation and starve the query). We own the
 * highlight via a controlled `selectedIndex`, keep the highlighted row visible
 * with `scrollChildIntoView`, and drive it from both the keyboard and the mouse.
 * ↑/↓ are handled on the dialog's layer (and consumed, so they never reach the
 * input's cursor); Enter arrives at the input as a submit; Esc is left for the
 * surrounding `Dialog`.
 */
export function DialogSearchList({
  items,
  onSelect,
  placeholder = "Type to search…",
  emptyText = "No matches.",
  listHeight = DEFAULT_LIST_HEIGHT,
  inlineDescription = false,
}: DialogSearchListProps) {
  // Focus the input only while this dialog is the active layer — otherwise a
  // dialog stacked on top would leave two live cursors.
  const isActive = useIsActiveLayer();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);

  // Keep the highlight in range as the filtered set shrinks/grows.
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);
  useEffect(() => {
    if (clampedIndex !== selectedIndex) setSelectedIndex(clampedIndex);
  }, [clampedIndex, selectedIndex]);

  // Keep the highlighted row visible as the selection moves (keyboard or mouse).
  useEffect(() => {
    if (filtered.length > 0) scrollRef.current?.scrollChildIntoView(rowId(clampedIndex));
  }, [clampedIndex, filtered.length]);

  const confirm = () => {
    const item = filtered[clampedIndex];
    if (item) onSelect(item);
  };

  // ↑/↓ scroll the list. Consuming them (return true) keeps them off the focused
  // input, whose single line has no use for them anyway. Everything else —
  // printable keys, backspace, paste, Enter — falls through to the input.
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
        <scrollbox ref={scrollRef} height={listHeight}>
          {(() => {
            const rows: ReactNode[] = [];
            let lastSection: string | undefined;
            filtered.forEach((item, i) => {
              if (item.section && item.section !== lastSection) {
                rows.push(
                  <text
                    key={`section-${item.section}`}
                    wrapMode="none"
                    fg={colors.muted}
                    marginTop={rows.length > 0 ? 1 : 0}
                    paddingLeft={1}
                  >
                    <b>{item.section}</b>
                  </text>,
                );
                lastSection = item.section;
              }
              const selected = i === clampedIndex;
              const nameFg = selected ? colors.background : colors.text;
              const descFg = selected ? colors.background : colors.muted;
              rows.push(
                <box
                  key={item.value}
                  id={rowId(i)}
                  flexShrink={0}
                  flexDirection={inlineDescription ? "row" : "column"}
                  width="100%"
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={selected ? colors.accent : undefined}
                  onMouseMove={() => setSelectedIndex(i)}
                  onMouseDown={() => onSelect(item)}
                >
                  <text wrapMode="none" fg={nameFg}>
                    {item.name}
                  </text>
                  {item.description ? (
                    <text wrapMode="none" fg={descFg}>
                      {inlineDescription ? `  ${item.description}` : item.description}
                    </text>
                  ) : null}
                </box>,
              );
            });
            return rows;
          })()}
        </scrollbox>
      )}

    </box>
  );
}
