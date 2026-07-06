/**
 * Central route path constants — keep route defs and `navigate()` calls in sync.
 *
 * A slash command typed into the prompt *is* the route path, so registering a
 * route here makes it reachable both via `navigate()` and as a slash command.
 * No separate command list to maintain.
 */
export const ROUTES = {
  home: "/",
  /** A conversation screen. The id is client-generated and used as the session id. */
  session: (id: string) => `/sessions/${id}`,
  /** API-key entry — masked field; stores the key in the OS keychain. */
  login: "/login",
} as const;
