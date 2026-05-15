import { Parsable } from "./Parsable";
import { Defaults } from "./ObjectTypes";
export interface LabelJSON {
  name: string;
  description: string;
}
export type LabelJSONMap = Record<string, LabelJSON>;
export const DEFAULT_LABEL_JSON: LabelJSON = {
  name: "",
  description: "",
};
export default class Label implements Parsable<LabelJSONMap, LabelJSON> {
  public name: string;
  public description: string;
  static build(obj: LabelJSON): Label {
    return new Label(obj.name, obj.description);
  }
  constructor(name = "", description = "") {
    this.name = name || "";
    this.description = description || "";
  }
  getName(): string {
    return this.name;
  }
  setName(name: string): void {
    this.name = name;
  }
  getDescription(): string {
    return this.description;
  }
  setDescription(description: string): void {
    this.description = description;
  }
  toJSON(): LabelJSON {
    return {
      name: this.name,
      description: this.description,
    };
  }
  getDefaultJSON(): LabelJSON {
    return DEFAULT_LABEL_JSON;
  }
  clone(): Label {
    return Label.build(this.toJSON());
  }
  getDefaultMappedJSON(): Defaults<LabelJSONMap> {
    return {
      label: DEFAULT_LABEL_JSON,
    };
  }
  toPartialMappedJSON(): Partial<LabelJSONMap> {
    return {
      label: {
        ...this.toJSON(),
      },
    };
  }
}
