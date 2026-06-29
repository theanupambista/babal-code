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
  return (
    <box flexDirection="column" alignItems="center" gap={1}>
      <ascii-font text={text} font="block" color={colors.accent} />
      {/* <text fg={colors.muted}>{tagline}</text> */}
    </box>
  );
}
