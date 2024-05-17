import { Defaults } from "./ObjectTypes";

export interface Parsable<ClassJSONMap, ClassJSON> {
  toJSON(): ClassJSON;
  toPartialMappedJSON(): Partial<ClassJSONMap>;

  getDefaultMappedJSON(): Defaults<ClassJSONMap>;
  getDefaultJSON(): ClassJSON;
}
