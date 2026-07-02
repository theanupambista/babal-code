/**
 * Central route path constants — keep route defs and `navigate()` calls in sync.
 *
 * A slash command typed into the prompt *is* the route path, so registering a
 * route here makes it reachable both via `navigate()` and as a slash command.
 * No separate command list to maintain.
 */
export const ROUTES = {
  home: "/",
  /** The session picker — lists past conversations to resume. */
  sessions: "/sessions",
  /** A conversation screen. The id is client-generated and used as the session id. */
  session: (id: string) => `/sessions/${id}`,
  /** Model picker — choose the active model from the provider's catalog. */
  model: "/model",
  /** API-key entry — masked field; stores the key in the OS keychain. */
  login: "/login",
} as const;
