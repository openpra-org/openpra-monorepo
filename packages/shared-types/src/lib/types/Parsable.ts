import { Defaults } from "./ObjectTypes";

/**
 * Contract for types that can serialize to JSON and provide default values.
 */
export interface Parsable<ClassJSONMap, ClassJSON> {
  /**
   * Serialize this instance to its JSON form.
   * @returns A JSON object representing this instance.
   */
  toJSON(): ClassJSON;
  /**
   * Serialize a partial, mapped JSON structure (e.g., keyed by identifier).
   * @returns A partial mapping from id to JSON representation.
   */
  toPartialMappedJSON(): Partial<ClassJSONMap>;

  /**
   * Provide default values for the mapped JSON shape.
   * @returns Defaults for the mapped JSON structure.
   */
  getDefaultMappedJSON(): Defaults<ClassJSONMap>;
  /**
   * Provide default values for the plain JSON shape.
   * @returns Defaults for the plain JSON structure.
   */
  getDefaultJSON(): ClassJSON;
}
