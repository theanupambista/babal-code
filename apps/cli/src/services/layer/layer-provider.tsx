import { useKeyboard, useRenderer } from "@opentui/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LayerStore, type LayerKeyHandler } from "./layer-store";

/** Id of the always-present base layer that hosts the routed screens. */
const BASE_LAYER_ID = "base";

type LayerContextValue = {
  store: LayerStore;
  /** The layer the current subtree belongs to. */
  layerId: string;
};

const LayerContext = createContext<LayerContextValue | null>(null);

function useLayerContext(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error("Layer hooks must be used within a <LayerProvider>");
  return ctx;
}

type LayerProviderProps = {
  children: ReactNode;
  /**
   * Called when a Ctrl+C reaches the bottom of the stack unclaimed — i.e. no
   * layer chose to override it. Defaults to tearing down the renderer (quit),
   * preserving the app's original `exitOnCtrlC` behaviour now that the renderer
   * itself is created with `exitOnCtrlC: false` so the service can own the key.
   */
  onExit?: () => void;
};

/**
 * Root of the layer service. Owns the single {@link LayerStore}, registers the
 * base layer that every screen lives on, and installs the one keyboard listener
 * that routes keys through the stack.
 *
 * Mount this above the router so the base layer — and the stack — survive
 * navigation. Because the renderer is created with `exitOnCtrlC: false`, Ctrl+C
 * arrives here as an ordinary key: a layer may claim it (clear an input, close a
 * dialog), and only an unclaimed Ctrl+C falls through to `onExit`.
 */
export function LayerProvider({ children, onExit }: LayerProviderProps) {
  const renderer = useRenderer();
  // One store for the app's lifetime.
  const [store] = useState(() => new LayerStore());

  // The base layer is non-modal: keys it doesn't handle fall through to the
  // app-level fallback below (so Ctrl+C can still quit). Registered for the
  // provider's whole lifetime.
  const [baseContext] = useState<LayerContextValue>(() => {
    store.register(BASE_LAYER_ID, { modal: false });
    return { store, layerId: BASE_LAYER_ID };
  });

  const exit = useCallback(() => (onExit ? onExit() : renderer.destroy()), [onExit, renderer]);

  useKeyboard((key) => {
    const result = store.dispatch(key);
    if (result === "consumed") {
      // Hide the key from every other listener and the focused renderable —
      // some layer already acted on it.
      key.stopPropagation();
      return;
    }
    // Nothing claimed it: the only app-level default is quit-on-Ctrl+C.
    if (result === "passthrough" && key.ctrl && key.name === "c") exit();
  });

  return <LayerContext.Provider value={baseContext}>{children}</LayerContext.Provider>;
}

/**
 * Establishes a new layer above the current one for the lifetime of its
 * children, and scopes them to it. Wrap anything that should sit "in front" —
 * a dialog, a popover, a full-screen overlay — in a `<Layer>`, and the input
 * behind it goes inert (unfocused, keyboard-trapped) exactly like the web.
 *
 * `modal` (default `true`) makes the layer trap keys it doesn't handle; pass
 * `modal={false}` for a non-trapping overlay that lets unhandled keys through.
 */
export function Layer({ children, modal }: { children: ReactNode; modal?: boolean }) {
  const { store } = useLayerContext();
  const id = useId();

  // Register during the first render (not an effect) so descendants can attach
  // key handlers in their own effects and already find this layer: a parent's
  // render runs before its children's renders and effects, whereas child effects
  // run before the parent's. `register` is idempotent, so a re-render is a no-op.
  const [layerContext] = useState<LayerContextValue>(() => {
    store.register(id, { modal });
    return { store, layerId: id };
  });

  // Pop the layer when this component unmounts (dialog closes).
  useEffect(() => () => store.unregister(id), [store, id]);

  return <LayerContext.Provider value={layerContext}>{children}</LayerContext.Provider>;
}

/**
 * Whether the current subtree's layer is the active (top) one. Drive an input's
 * `focused` prop with this so it only shows a live cursor while nothing is
 * stacked in front of it — the fix for a textarea's cursor bleeding through a
 * dialog. Combine with any local condition (`isActiveLayer && !busy`).
 */
export function useIsActiveLayer(): boolean {
  const { store, layerId } = useLayerContext();
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const getSnapshot = useCallback(() => store.isTop(layerId), [store, layerId]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Subscribe to keyboard input scoped to the current layer. Unlike the raw
 * `useKeyboard`, the handler only fires while this layer is reachable in the
 * stack (i.e. it's on top, or nothing modal sits above it), so background
 * screens stop reacting to keys the moment a dialog opens. Return `true` from
 * the handler to consume the key and stop it propagating further.
 *
 * The latest closure is always invoked, so values referenced inside are never
 * stale — no dependency array needed.
 */
export function useLayerKeyboard(handler: LayerKeyHandler): void {
  const { store, layerId } = useLayerContext();

  // Keep a stable subscription that always calls the newest handler.
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    return store.addHandler(layerId, (key) => handlerRef.current(key));
  }, [store, layerId]);
}
