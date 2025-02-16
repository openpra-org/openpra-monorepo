import typia, { tags } from "typia";

/**
 * Interface representing a unique entity with a UUID.
 *
 * @example
 * ```
 * const uniqueEntity: Unique = {
 *   uuid: "123e4567-e89b-12d3-a456-426614174000"
 * };
 * ```
 */
export interface Unique {
  uuid: tags.Format<"uuid">;
}

/**
 * Interface representing an entity with a name.
 *
 * @example
 * ```
 * const namedEntity: Named = {
 *   name: "Sample Name"
 * };
 * ```
 */
export interface Named {
  name: string;
}

/**
 * JSON schema for validating {@link Unique} entities.
 *
 * @example
 * ```
 * const isValid = UniqueTagSchema.validate(someData);
 * ```
 */
export const UniqueTagSchema = typia.json.application<[Unique], "3.0">();

/**
 * JSON schema for validating {@link Named} entities.
 *
 * @example
 * ```
 * const isValid = NamedTagSchema.validate(someData);
 * ```
 */
export const NamedTagSchema = typia.json.application<[Named], "3.0">();
