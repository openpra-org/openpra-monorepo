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

  /**
   * Build a Label from its JSON representation.
   * @param obj - JSON object to parse
   * @returns A new Label instance
   */
  static build(obj: LabelJSON): Label {
    return new Label(obj.name, obj.description);
  }

  /**
   * Create a new Label.
   * @param name - The label name
   * @param description - The label description
   */
  constructor(name = "", description = "") {
    this.name = name || "";
    this.description = description || "";
  }

  /**
   * @returns The label name
   */
  getName(): string {
    return this.name;
  }

  /**
   * @param name - New label name
   */
  setName(name: string): void {
    this.name = name;
  }

  /**
   * @returns The label description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * @param description - New label description
   */
  setDescription(description: string): void {
    this.description = description;
  }

  /**
   * @returns Dictionary object that represents this label
   */
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
