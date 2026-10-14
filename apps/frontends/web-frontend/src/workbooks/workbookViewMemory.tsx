import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
  type SetStateAction,
} from "react";
import { z } from "zod";

interface ViewCodec<T> {
  read: (text: string) => T | undefined;
  write: (value: T) => string;
}

interface ViewSlot<T> {
  read: () => T | undefined;
  write: (value: T) => void;
}

interface ViewStore {
  read: (key: string) => string | undefined;
  write: (key: string, text: string, saved: boolean) => void;
  subscribe: (listener: () => void) => () => void;
  flush: () => void;
}

const STORAGE_PREFIX = "openpra.workbooks.view.";
const SavedTextsSchema = z.record(z.string(), z.string());
const ViewStoreContext = createContext<ViewStore | null>(null);

function jsonView<T>(schema: z.ZodType<T>): ViewCodec<T> {
  return {
    read: (text) => {
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data : undefined;
      } catch {
        return undefined;
      }
    },
    write: (value) => JSON.stringify(value),
  };
}

const TEXT_VIEW = jsonView<string>(z.string());
const OPTIONAL_TEXT_VIEW = jsonView<string | null>(z.string().nullable());
const FLAG_VIEW = jsonView<boolean>(z.boolean());
const COUNT_VIEW = jsonView<number>(z.number().int().nonnegative());

function savedTexts(storageKey: string | null): Map<string, string> {
  if (storageKey === null) return new Map();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return new Map();
    const parsed = SavedTextsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? new Map(Object.entries(parsed.data)) : new Map();
  } catch {
    return new Map();
  }
}

function createViewStore(scope: string | null): ViewStore {
  const storageKey = scope === null ? null : `${STORAGE_PREFIX}${scope}`;
  const texts = savedTexts(storageKey);
  const saved = new Set(texts.keys());
  const listeners = new Set<() => void>();
  let dirty = false;
  return {
    read: (key) => texts.get(key),
    write: (key, text, keep) => {
      const changed = texts.get(key) !== text;
      const wasSaved = saved.has(key);
      if (!changed && wasSaved === keep) return;
      texts.set(key, text);
      if (keep) saved.add(key);
      else saved.delete(key);
      if (keep || wasSaved) dirty = true;
      if (changed) listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush: () => {
      if (!dirty || storageKey === null) return;
      dirty = false;
      const entries = [...saved].flatMap((key) => {
        const text = texts.get(key);
        return text === undefined ? [] : [[key, text] as const];
      });
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)));
      } catch {
        dirty = true;
      }
    },
  };
}

function WorkbookViewMemory({ scope, children }: { scope: string | null; children: ReactNode }): JSX.Element {
  const held = useRef<{ scope: string | null; store: ViewStore } | null>(null);
  if (held.current === null || held.current.scope !== scope) held.current = { scope, store: createViewStore(scope) };
  const store = held.current.store;
  useEffect(() => {
    const flush = (): void => store.flush();
    const hide = (): void => {
      if (document.visibilityState === "hidden") store.flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hide);
      store.flush();
    };
  }, [store]);
  return <ViewStoreContext.Provider value={store}>{children}</ViewStoreContext.Provider>;
}

function unsubscribed(): () => void {
  return () => undefined;
}

function isUpdate<T>(next: SetStateAction<T>): next is (current: T) => T {
  return typeof next === "function";
}

function useWorkbookView<T>(key: string, initial: T, codec: ViewCodec<T>, saved = true): [T, (next: SetStateAction<T>) => void] {
  const store = useContext(ViewStoreContext);
  const [own, setOwn] = useState<{ key: string; value: T }>(() => ({ key, value: initial }));
  const fallback = useRef(initial);
  fallback.current = initial;
  const text = useSyncExternalStore(store === null ? unsubscribed : store.subscribe, () => store?.read(key));
  const held = useMemo(() => (text === undefined ? undefined : codec.read(text)), [codec, text]);
  const setValue = useCallback((next: SetStateAction<T>): void => {
    if (store === null) {
      setOwn((current) => {
        const base = current.key === key ? current.value : fallback.current;
        return { key, value: isUpdate(next) ? next(base) : next };
      });
      return;
    }
    const stored = store.read(key);
    const decoded = stored === undefined ? undefined : codec.read(stored);
    const base = decoded === undefined ? fallback.current : decoded;
    store.write(key, codec.write(isUpdate(next) ? next(base) : next), saved);
  }, [codec, key, saved, store]);
  if (store === null) return [own.key === key ? own.value : initial, setValue];
  return [held === undefined ? initial : held, setValue];
}

function useWorkbookViewSlot<T>(key: string, codec: ViewCodec<T>, saved = true): ViewSlot<T> {
  const store = useContext(ViewStoreContext);
  const [own] = useState(() => new Map<string, T>());
  return useMemo<ViewSlot<T>>(() => ({
    read: () => {
      if (store === null) return own.get(key);
      const text = store.read(key);
      return text === undefined ? undefined : codec.read(text);
    },
    write: (value) => {
      if (store === null) own.set(key, value);
      else store.write(key, codec.write(value), saved);
    },
  }), [codec, key, own, saved, store]);
}

export {
  COUNT_VIEW,
  FLAG_VIEW,
  OPTIONAL_TEXT_VIEW,
  TEXT_VIEW,
  WorkbookViewMemory,
  jsonView,
  useWorkbookView,
  useWorkbookViewSlot,
  type ViewCodec,
  type ViewSlot,
};
