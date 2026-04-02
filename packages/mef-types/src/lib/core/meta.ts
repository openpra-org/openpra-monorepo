/**
 * @packageDocumentation
 * @module technical_elements.core
 */

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
 * @hidden
 */
export interface Unique {
  uuid: string;
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
 * @hidden
 */
export interface Named {
  name: string;
  description?: string;
}

/**
 * @internal
 * JSON schema for validating {@link Unique} entities.
 * @memberof technical_elements.core
 * @example
 * ```
 * const isValid = UniqueTagSchema.validate(someData);
 * ```
 * @hidden
 */

/**
 * @internal
 * JSON schema for validating {@link Named} entities.
 * @memberof technical_elements.core
 * @example
 * ```
 * const isValid = NamedTagSchema.validate(someData);
 * ```
 * @hidden
 */

export interface Versioned {
  version: string;
  lastUpdated: string;
}
