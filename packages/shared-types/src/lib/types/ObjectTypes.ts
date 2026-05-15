export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];
export type Defaults<T> = Required<Pick<T, OptionalKeys<T>>>;
