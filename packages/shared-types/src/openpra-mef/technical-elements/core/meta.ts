/**
 * @packageDocumentation
 * @module technical_elements.core
 */
import typia, { tags } from "typia";

/**
 * @internal
 * Interface representing a unique entity with a UUID.
 * @memberof technical_elements.core
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
 * @internal
 * Interface representing an entity with a name.
 * @memberof technical_elements.core
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
 * @internal
 * JSON schema for validating {@link Unique} entities.
 * @memberof technical_elements.core
 * @example
 * ```
 * const isValid = UniqueTagSchema.validate(someData);
 * ```
 */
export const UniqueTagSchema = typia.json.application<[Unique], "3.0">();

/**
 * @internal
 * JSON schema for validating {@link Named} entities.
 * @memberof technical_elements.core
 * @example
 * ```
 * const isValid = NamedTagSchema.validate(someData);
 * ```
 */
export const NamedTagSchema = typia.json.application<[Named], "3.0">();