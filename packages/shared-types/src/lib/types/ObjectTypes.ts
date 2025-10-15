export type OptionalKeys<T> = {
  // Using Record<string, never> to represent an empty object type for conditional check
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];
export type Defaults<T> = Required<Pick<T, OptionalKeys<T>>>;
