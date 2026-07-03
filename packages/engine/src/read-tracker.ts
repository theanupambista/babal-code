/**
 * Records which files were read this process and their mtime at read time, so
 * `editFile` can refuse edits to files that were never read or changed on disk since
 * (mirrors Claude Code's Edit gates). Process-global: the CLI runs one session per
 * process and tool `execute` gets no session id to key on.
 */
const lastReadMtimeMs = new Map<string, number>();

export function recordFileRead(absPath: string, mtimeMs: number): void {
  lastReadMtimeMs.set(absPath, mtimeMs);
}

export function getFileReadMtime(absPath: string): number | undefined {
  return lastReadMtimeMs.get(absPath);
}

/**
 * Forget all read-state. Call when the active session changes (switch/resume) or its
 * context is cleared: reads from the previous conversation must not count for the new
 * one, so the first edit is forced to read the file again.
 */
export function clearReadTracker(): void {
  lastReadMtimeMs.clear();
}
