import { AsyncLocalStorage } from "node:async_hooks";

const snapshots = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/** One consistent workbook version per execution, shared by every model adapter. */
export function WithWorkbookSnapshots(): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const execute = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      return snapshots.run(new Map(), () => execute.apply(this, args));
    };
  };
}

export function loadWorkbookSnapshot<T>(key: string, load: () => Promise<T>): Promise<T> {
  const scope = snapshots.getStore();
  if (scope === undefined) return load();
  let pending = scope.get(key);
  if (pending === undefined) {
    pending = load();
    scope.set(key, pending);
  }
  return pending as Promise<T>;
}
