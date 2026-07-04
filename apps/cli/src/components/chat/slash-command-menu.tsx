import type { SlashCommand } from "../../commands";
import { colors } from "../../theme";

type SlashCommandMenuProps = {
  /** The filtered commands to show (already ranked). */
  commands: readonly SlashCommand[];
  /** Index of the highlighted row. */
  selectedIndex: number;
};

/** Column width the command names are padded to so descriptions line up. */
const NAME_COLUMN = 14;

/**
 * Autocomplete popup listing slash commands, rendered directly above the prompt
 * input (opencode-style). Purely presentational: `ChatTextarea` owns the query,
 * filtering, and selection, and drives navigation via the keyboard.
 *
 * The highlighted row is a full-width accent bar with dark text; other rows show
 * the command in body text and the description muted. Kept dependency-free — the
 * command set is small, so a padded two-column list reads clearly without a table
 * or fuzzy-match library.
 */
export function SlashCommandMenu({ commands, selectedIndex }: SlashCommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <box flexShrink={0} flexDirection="column" width="100%" marginBottom={1}>
      {commands.map((cmd, i) => {
        const selected = i === selectedIndex;
        return (
          <box
            key={cmd.command}
            flexDirection="row"
            width="100%"
            backgroundColor={selected ? colors.accent : undefined}
          >
            <text fg={selected ? colors.background : colors.text}>
              {cmd.command.padEnd(NAME_COLUMN)}
            </text>
            <text fg={selected ? colors.background : colors.muted}>{cmd.description}</text>
          </box>
        );
      })}
    </box>
  );
}
