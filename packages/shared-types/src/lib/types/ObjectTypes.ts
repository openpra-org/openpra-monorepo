/**
 * Represents a type that extracts optional keys from a type `T`.
 * This type utility will iterate over all keys of `T` and pick those keys which are optional.
 *
 * @typeParam T - The target type from which optional keys are to be extracted.
 *
 * @example
 * interface Example \{
 *   required: number;
 *   optional?: string;
 * \}
 *
 * // Result: "optional"
 * type OptionalKeysExample = OptionalKeys<Example>;
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: NonNullable<unknown> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Represents a type that constructs a type with all optional keys of `T` made required.
 * This utility type is useful for ensuring that all optional properties are treated as required,
 * based on the `OptionalKeys` type utility.
 *
 * @typeParam T - The target type which will have its optional keys made required.
 *
 * @example
 * interface Example \{
 *   required: number;
 *   optional?: string;
 * \}
 *
 * // Result: \{ optional: string; \}
 * type DefaultsExample = Defaults<Example>;
 */
export type Defaults<T> = Required<Pick<T, OptionalKeys<T>>>;

/**
 * Represents a type that ensures an array has at least one element of type `T`.
 * This is useful for cases where you need to guarantee that an array isn't empty.
 *
 * @typeParam T - The type of the elements in the array.
 *
 * @example
 * // Result: [number, ...number[]]
 * type NonEmptyArrayOfNumbers = NonEmptyArray<number>;
 */
export type NonEmptyArray<T> = [T, ...T[]];
