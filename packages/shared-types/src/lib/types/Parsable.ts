import { Defaults } from "./ObjectTypes";

/**
 * Contract for types that can serialize to JSON and provide default values.
 */
export interface Parsable<ClassJSONMap, ClassJSON> {
  toJSON(): ClassJSON;
  toPartialMappedJSON(): Partial<ClassJSONMap>;

  getDefaultMappedJSON(): Defaults<ClassJSONMap>;
  getDefaultJSON(): ClassJSON;
}
