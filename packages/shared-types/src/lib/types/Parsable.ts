import { Defaults } from "./ObjectTypes";

export type Parsable<ClassJSONMap, ClassJSON> = {
  toJSON(): ClassJSON;
  toPartialMappedJSON(): Partial<ClassJSONMap>;

  getDefaultMappedJSON(): Defaults<ClassJSONMap>;
  getDefaultJSON(): ClassJSON;
};
