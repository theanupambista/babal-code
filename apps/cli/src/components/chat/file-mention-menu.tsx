import { colors } from "../../theme";

type FileMentionMenuProps = {
  /** The filtered, ranked workspace-relative file paths to show. */
  files: readonly string[];
  /** Index of the highlighted row. */
  selectedIndex: number;
  /** Move the highlight to a row (hovering with the mouse). */
  onHighlight?: (index: number) => void;
  /** Accept a row (clicking with the mouse). */
  onSelect?: (index: number) => void;
};

/**
 * Autocomplete popup listing workspace files, rendered directly above the prompt
 * input — the `@`-mention counterpart to `SlashCommandMenu`. Purely
 * presentational: `ChatTextarea` owns the query, the file list, filtering, and
 * selection, and drives navigation via the keyboard.
 *
 * The highlighted row is a full-width accent bar with dark text; other rows show
 * the path in body text. Paths are single-column (no description), so the row is
 * just the path — the directory prefix is muted so the filename reads first.
 */
export function FileMentionMenu({
  files,
  selectedIndex,
  onHighlight,
  onSelect,
}: FileMentionMenuProps) {
  if (files.length === 0) return null;

  return (
    <box flexShrink={0} flexDirection="column" width="100%" marginBottom={1}>
      {files.map((path, i) => {
        const selected = i === selectedIndex;
        // Split off the directory prefix so the filename can read brighter.
        const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        const dir = slash === -1 ? "" : path.slice(0, slash + 1);
        const name = slash === -1 ? path : path.slice(slash + 1);
        return (
          <box
            key={path}
            flexDirection="row"
            width="100%"
            backgroundColor={selected ? colors.accent : undefined}
            onMouseMove={() => onHighlight?.(i)}
            onMouseDown={() => onSelect?.(i)}
          >
            <text>
              <span fg={selected ? colors.background : colors.muted}>{dir}</span>
              <span fg={selected ? colors.background : colors.text}>{name}</span>
            </text>
          </box>
        );
      })}
    </box>
  );
}
