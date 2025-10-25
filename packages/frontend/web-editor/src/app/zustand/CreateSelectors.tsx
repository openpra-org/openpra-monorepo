import { StoreApi, UseBoundStore } from "zustand";

type WithSelectors<S> = S extends { getState: () => infer T } ? S & { use: { [K in keyof T]: () => T[K] } } : never;

const CreateSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S): WithSelectors<S> => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {} as Record<string, () => unknown>;
  for (const k of Object.keys(store.getState())) {
    (store.use as Record<string, () => unknown>)[k] = (): unknown => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export { CreateSelectors };
