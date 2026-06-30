import { hc } from "hono/client";
import type { AppType } from "@babalcode/server/app";

/** Base URL of the @babalcode/server instance. Override with SERVER_URL. */
const baseUrl = process.env.SERVER_URL ?? "http://localhost:3000";

/**
 * Type-safe RPC client for `@babalcode/server`, inferred from the server's
 * exported `AppType`. Use it as the CLI's fetcher, e.g.:
 *
 * ```ts
 * const res = await client.health.$get();
 * const data = await res.json(); // fully typed
 * ```
 */
export const client = hc<AppType>(baseUrl);
