export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
export type Defaults<T> = Required<Pick<T, OptionalKeys<T>>>;
