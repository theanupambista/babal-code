/** Central route path constants — keep route defs and `navigate()` calls in sync. */
export const ROUTES = {
  home: "/",
  settings: "/settings",
} as const;

/**
 * Slash commands typed into the prompt that navigate to a screen.
 * Add a screen here to make it reachable via `/name` from the textarea.
 */
export const SLASH_ROUTES: Record<string, string> = {
  "/home": ROUTES.home,
  "/settings": ROUTES.settings,
};
