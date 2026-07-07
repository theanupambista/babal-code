import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { generateId, type UIMessage } from "ai";
import { projectDir, sessionFile } from "./paths";

/**
 * A session's on-disk history is an append-only JSONL log — one event per line —
 * replacing the former Prisma `Entry` timeline. `message` events carry a
 * `UIMessage`; `error` events record a failed turn. Ordering is the append order.
 */
type MessageEvent = {
  type: "message";
  messageId: string;
  role: string;
  parts: unknown;
  /** Per-message metadata (e.g. the mode the user sent it in); */
  metadata?: unknown;
  ts: string;
};
type ErrorEvent = {
  type: "error";
  errorText: string;
  stack: string | null;
  ts: string;
};
type SessionEvent = MessageEvent | ErrorEvent;

/** Summary row for the CLI's session picker — shape mirrors the old list endpoint. */
export type SessionSummary = {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
};

/** Model label stamped on user messages by `runAgent` for the session picker. */
function modelFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const model = (metadata as { model?: unknown }).model;
  return typeof model === "string" ? model : null;
}

/** First text snippet in a message's parts — a human label for the session list. */
function previewFromParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (
      typeof part === "object" &&
      part !== null &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return null;
}

/** Append one event to a session's log, creating the project directory on demand. */
async function append(sessionId: string, event: SessionEvent): Promise<void> {
  await mkdir(projectDir(), { recursive: true });
  await appendFile(
    sessionFile(sessionId),
    `${JSON.stringify(event)}\n`,
    "utf8",
  );
}

/**
 * Record a message. Idempotency is by `messageId` at read time (last write wins),
 * so a client re-send updates in place instead of duplicating — mirroring the old
 * upsert on `(sessionId, messageId)`.
 */
export async function appendMessage(
  sessionId: string,
  message: { id?: string; role: string; parts: unknown; metadata?: unknown },
): Promise<void> {
  await append(sessionId, {
    type: "message",
    messageId: message.id ?? generateId(),
    role: message.role,
    parts: message.parts,
    metadata: message.metadata,
    ts: new Date().toISOString(),
  });
}

/** Record a failed turn at its point in the timeline. */
export async function appendError(
  sessionId: string,
  error: unknown,
): Promise<void> {
  await append(sessionId, {
    type: "error",
    errorText: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? null) : null,
    ts: new Date().toISOString(),
  });
}

/** Parse a session file into its events, tolerating malformed/blank lines. */
async function readEvents(sessionId: string): Promise<SessionEvent[]> {
  let raw: string;
  try {
    raw = await readFile(sessionFile(sessionId), "utf8");
  } catch {
    return []; // unknown/never-persisted session
  }
  const events: SessionEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as SessionEvent);
    } catch {
      // skip a corrupt line rather than losing the whole session
    }
  }
  return events;
}

/**
 * Replay a session's messages as `UIMessage[]`, ready to seed the CLI's `useChat`.
 * Only `message` events are replayed (errors are kept on disk but `useChat` treats
 * them as live-only). Deduped by `messageId`, last write winning while keeping the
 * original position. Missing session → `[]`.
 */
export async function loadMessages(sessionId: string): Promise<UIMessage[]> {
  const byId = new Map<string, UIMessage>();
  for (const event of await readEvents(sessionId)) {
    if (event.type !== "message") continue;
    // `Map.set` on an existing key preserves its original insertion order.
    byId.set(event.messageId, {
      id: event.messageId,
      role: event.role as UIMessage["role"],
      parts: event.parts as UIMessage["parts"],
      ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
    });
  }
  return [...byId.values()];
}

/**
 * List every session for the current workspace, newest activity first. Metadata is
 * derived from each file (no separate index): `createdAt`/`updatedAt` from the first
 * and last event timestamps, `preview` from the first user message.
 */
export async function listSessions(): Promise<SessionSummary[]> {
  let files: string[];
  try {
    files = await readdir(projectDir());
  } catch {
    return [];
  }

  const summaries: SessionSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const id = path.basename(file, ".jsonl");
    const events = await readEvents(id);
    if (events.length === 0) continue;

    const first = events[0];
    const last = events[events.length - 1];
    let preview: string | null = null;
    let model: string | null = null;
    for (const event of events) {
      if (event.type !== "message" || event.role !== "user") continue;
      if (!preview) preview = previewFromParts(event.parts);
      if (!model) model = modelFromMetadata(event.metadata);
      if (preview && model) break;
    }

    summaries.push({
      id,
      title: null,
      model,
      createdAt: first?.ts ?? new Date(0).toISOString(),
      updatedAt: last?.ts ?? new Date(0).toISOString(),
      preview,
    });
  }

  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}
