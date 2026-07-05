import type { KeyEvent } from "@opentui/core";

/**
 * A key handler registered by a layer. Return `true` (or call
 * `key.stopPropagation()`) to *consume* the event: it stops travelling down the
 * stack and is hidden from the rest of the app (other `useKeyboard` handlers and
 * the focused renderable). Return nothing to let it keep bubbling.
 */
export type LayerKeyHandler = (key: KeyEvent) => boolean | void;

export type LayerOptions = {
  /**
   * A modal layer *traps* input: keys it doesn't explicitly consume are still
   * swallowed rather than falling through to the layers beneath it — the
   * web-modal behaviour where an open dialog captures the keyboard and the page
   * behind it goes inert. The base (screen) layer is non-modal so unhandled keys
   * can reach the app-level fallback (e.g. Ctrl+C → exit). Defaults to `true`.
   */
  modal?: boolean;
};

/** Outcome of dispatching a key through the stack. */
export type DispatchResult =
  /** A layer handler took the key (stop other listeners + the focused renderable). */
  | "consumed"
  /** A modal layer let the key go unhandled, but trapped it from lower layers. */
  | "swallowed"
  /** No layer claimed the key; the app-level default may act on it. */
  | "passthrough";

type LayerRecord = {
  id: string;
  modal: boolean;
  handlers: Set<LayerKeyHandler>;
};

/**
 * The z-ordered stack of interaction layers behind the layer service.
 *
 * Layers are pushed as UI opens (a screen at the bottom, dialogs/menus above)
 * and popped as it closes; the last entry is the *active* (top) layer. The store
 * is the single source of truth for two things the TUI otherwise has to
 * coordinate by hand:
 *
 * - **Keyboard routing.** `dispatch` walks the stack top-down so the active
 *   layer sees each key first and can consume it, modelling the browser's
 *   capture/stop-propagation behaviour on a terminal that has none.
 * - **Focus ordering.** `isTop` lets an element render as focused only while its
 *   layer is on top, so an input behind a dialog stops showing a live cursor.
 *
 * It is a plain observable (framework-agnostic); React binds to it through the
 * provider/hooks via `subscribe`/`getSnapshot`.
 */
export class LayerStore {
  private layers: LayerRecord[] = [];
  private listeners = new Set<() => void>();
  /** Bumped on every mutation so `useSyncExternalStore` can detect changes. */
  private version = 0;

  /**
   * Push a layer onto the top of the stack (or, if `id` is already present, move
   * it back to the top — e.g. a remount). Idempotent so callers can register
   * during render without worrying about double invocation.
   */
  register(id: string, options: LayerOptions = {}): void {
    this.removeById(id);
    this.layers.push({ id, modal: options.modal ?? true, handlers: new Set() });
    this.emitChange();
  }

  /** Remove a layer from the stack. No-op if it isn't registered. */
  unregister(id: string): void {
    if (this.removeById(id)) this.emitChange();
  }

  /**
   * Attach a key handler to a layer. Returns a disposer. If the layer isn't
   * registered (yet) the handler is dropped and the disposer is a no-op —
   * callers always establish their layer before attaching handlers.
   */
  addHandler(id: string, handler: LayerKeyHandler): () => void {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return () => {};
    layer.handlers.add(handler);
    return () => {
      layer.handlers.delete(handler);
    };
  }

  /** Whether `id` is the active (top) layer. */
  isTop(id: string): boolean {
    return this.layers.at(-1)?.id === id;
  }

  /** The active (top) layer id, or `null` when the stack is empty. */
  topId(): string | null {
    return this.layers.at(-1)?.id ?? null;
  }

  /**
   * Route a key through the stack, top-down. Each layer's handlers run in
   * registration order; the first to consume the key ends dispatch. A modal
   * layer that doesn't consume the key still ends dispatch (the trap), so keys
   * never leak to the screen behind an open dialog. Only when a non-modal layer
   * declines the key does it fall through to the layer below — and past the
   * bottom to the caller as `"passthrough"`.
   */
  dispatch(key: KeyEvent): DispatchResult {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i]!;
      // Snapshot the handler set: a handler may open/close a layer mid-dispatch.
      for (const handler of [...layer.handlers]) {
        if (handler(key) === true || key.propagationStopped) return "consumed";
      }
      if (layer.modal) return "swallowed";
    }
    return "passthrough";
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): number {
    return this.version;
  }

  private removeById(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) return false;
    this.layers.splice(index, 1);
    return true;
  }

  private emitChange(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }
}
