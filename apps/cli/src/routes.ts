/**
 * Central route path constants — keep route defs and `navigate()` calls in sync.
 *
 * A slash command typed into the prompt *is* the route path (e.g. `/settings`),
 * so registering a route here makes it reachable both via `navigate()` and as a
 * slash command. No separate command list to maintain.
 */
export const ROUTES = {
  home: "/",
  settings: "/settings",
} as const;
