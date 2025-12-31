import { StoreApi, UseBoundStore } from "zustand";

/**
 * Augmented store type with `use.*` selector hooks mapped to each state key.
 */
type WithSelectors<S> = S extends { getState: () => infer T } ? S & { use: { [K in keyof T]: () => T[K] } } : never;

/**
 * Decorate a Zustand store with derived selector hooks at `use.*`.
 *
 * @param _store - The base Zustand store to enhance.
 * @returns The same store instance with `use.*` selector functions.
 */
const CreateSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S): WithSelectors<S> => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {} as Record<string, () => unknown>;
  for (const k of Object.keys(store.getState())) {
    (store.use as Record<string, () => unknown>)[k] = (): unknown => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export { CreateSelectors };
