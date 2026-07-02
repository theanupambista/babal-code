import { colors } from "../theme";

type LogoProps = {
  /** Banner text rendered as ASCII art. */
  text?: string;
  /** Tagline shown beneath the banner. */
  tagline?: string;
};

/**
 * Home-screen banner: the BABALCODE ASCII wordmark plus a short tagline.
 */
export function Logo({ text = "BABALCODE" }: LogoProps) {
  const prefix = text.slice(0, 5);
  const suffix = text.slice(5);

  return (
    <box flexDirection="column" alignItems="center" gap={1}>
      <box flexDirection="row" gap={2}>
        <ascii-font text={prefix} font="block" color="#808080" />
        <ascii-font text={suffix} font="block" color={colors.accent} />
      </box>
      {/* <text fg={colors.muted}>{tagline}</text> */}
    </box>
  );
}
