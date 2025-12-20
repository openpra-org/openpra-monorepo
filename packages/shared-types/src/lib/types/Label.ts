import { Parsable } from './Parsable';
import { Defaults } from './ObjectTypes';

/** JSON shape for a label (name + description). */
export interface LabelJSON {
  name: string;
  description: string;
}

/** Map of label identifiers to their JSON representation. */
export type LabelJSONMap = Record<string, LabelJSON>;

/** Default, empty label JSON. */
export const DEFAULT_LABEL_JSON: LabelJSON = {
  name: '',
  description: '',
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
  constructor(name = '', description = '') {
    this.name = name || '';
    this.description = description || '';
  }

  /**
   * @returns The label name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Update the label name.
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
   * Update the label description.
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

  /**
   * Get the default JSON representation for a label.
   * @returns Default Label JSON values.
   */
  getDefaultJSON(): LabelJSON {
    return DEFAULT_LABEL_JSON;
  }

  /**
   * Create a deep copy of this label.
   * @returns A cloned Label instance.
   */
  clone(): Label {
    return Label.build(this.toJSON());
  }

  /**
   * Default mapped JSON shape keyed by a canonical label id.
   * @returns Defaults for the label JSON map.
   */
  getDefaultMappedJSON(): Defaults<LabelJSONMap> {
    return {
      label: DEFAULT_LABEL_JSON,
    };
  }

  /**
   * Partial mapped JSON for this label keyed by a canonical label id.
   * @returns A mapping with the current label JSON.
   */
  toPartialMappedJSON(): Partial<LabelJSONMap> {
    return {
      label: {
        ...this.toJSON(),
      },
    };
  }
}
