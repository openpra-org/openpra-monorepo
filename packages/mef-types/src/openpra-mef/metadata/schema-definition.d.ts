/**
 * Extends the JSON Schema draft 2020-12
 */
export interface OpenPRAMEFSchemaDefinition {
  /**
   * An array of example data conforming to the schema
   */
  examples: unknown[];
  /**
   * Canonical definition for the entity.
   */
  definition: string;
}
