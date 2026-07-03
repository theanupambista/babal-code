import { generateId } from "ai";
import { evaluate } from "./rules";
import {
  loadPermissionConfig,
  loadRememberedDecisions,
  rememberDecision,
  type PermissionConfig,
  type RememberedDecisions,
} from "./store";
import {
  PermissionDeniedError,
  PermissionRejectedError,
  type PendingPermission,
  type PermissionAction,
  type PermissionDecision,
  type PermissionRequest,
} from "./types";

/** A promise plus its externally-callable resolve/reject — the registry primitive. */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Process-global state (like read-tracker's module state and run-command's currentCwd).
const registry = new Map<
  string,
  { request: PendingPermission; deferred: Deferred<void> }
>();
const listeners = new Set<() => void>();
// Cached snapshot so `pending()` returns a stable reference between changes — required
// by `useSyncExternalStore`, which would loop forever on a fresh array each call.
let snapshot: readonly PendingPermission[] = [];

// Rules are read from disk once and cached; `ask()` awaits this before evaluating.
let config: PermissionConfig = {};
let remembered: RememberedDecisions = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  [config, remembered] = await Promise.all([
    loadPermissionConfig(),
    loadRememberedDecisions(),
  ]);
  loaded = true;
}

function rebuildSnapshot(): void {
  snapshot = [...registry.values()].map((entry) => entry.request);
  for (const listener of listeners) listener();
}

/** @see PermissionService */
export interface PermissionService {
  evaluate(req: PermissionRequest): PermissionAction;
  ask(req: PermissionRequest): Promise<void>;
  reply(id: string, decision: PermissionDecision): void;
  pending(): readonly PendingPermission[];
  subscribe(listener: () => void): () => void;
}

/**
 * The permission broker — a capability tools `await` before a side-effecting
 * action. `ask()` blocks the turn
 * (the `streamText` loop suspends inside the tool call) until the TUI `reply()`s.
 * A single process-global instance, subscribed to by the React TUI via
 * `useSyncExternalStore(subscribe, pending)`.
 */
export const permission: PermissionService = {
  evaluate(req) {
    return evaluate(req, config, remembered);
  },

  async ask(req) {
    await ensureLoaded();
    const action = evaluate(req, config, remembered);
    if (action === "allow") return;
    if (action === "deny") {
      throw new PermissionDeniedError(
        `Permission denied by a configured rule: ${req.title}`,
      );
    }

    // "ask": register a pending request and block until the user replies.
    const id = generateId();
    const deferred = defer<void>();
    registry.set(id, { request: { ...req, id }, deferred });
    rebuildSnapshot();
    return deferred.promise;
  },

  reply(id, decision) {
    const entry = registry.get(id);
    if (!entry) return; // unknown / already-answered id
    registry.delete(id);
    rebuildSnapshot();

    const { request } = entry;
    if (decision.scope === "always") {
      // Update the in-memory cache immediately, then persist (fire-and-forget).
      remembered = {
        ...remembered,
        [request.tool]: {
          ...(remembered[request.tool] ?? {}),
          [request.pattern]: decision.type,
        },
      };
      void rememberDecision(request.tool, request.pattern, decision.type);
    }

    if (decision.type === "allow") {
      entry.deferred.resolve();
    } else {
      entry.deferred.reject(
        new PermissionRejectedError(
          decision.feedback ?? `User denied permission: ${request.title}`,
          decision.feedback,
        ),
      );
    }
  },

  pending() {
    return snapshot;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
