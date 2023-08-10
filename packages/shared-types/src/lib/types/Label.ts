import {Parsable} from "./Parsable";
import { Defaults } from "./ObjectTypes";

export interface LabelJSON {
  name: string;
  description: string;
}

export type LabelJSONMap = {[key: string]: LabelJSON};

export const DEFAULT_LABEL_JSON: LabelJSON = {
  name: '',
  description: '',
};

export default class Label implements Parsable<LabelJSONMap, LabelJSON> {
  public name: string;
  public description: string;

  /**
   * @param {LabelJSON} obj - dictionary object to parse
   * @return {HCLText.ts}
   */
  static build(obj: LabelJSON): Label {
    return new Label(obj.name, obj.description);
  }

  /**
   * @param {string} name
   * @param {string} description
   */
  constructor(name = '', description = '') {
    this.name = name || '';
    this.description = description || '';
  }

  /**
   * @return {string}
   */
  getName(): string {
    return this.name;
  }


  /**
   * @param {string} name
   */
  setName(name: string) {
    this.name = name;
  }


  /**
   * @return {string}
   */
  getDescription(): string {
    return this.description;
  }


  /**
   * @param {string} description
   */
  setDescription(description: string) {
    this.description = description;
  }

  /**
   * @return {LabelJSON} - dictionary object that represents this
   */
  toJSON(): LabelJSON {
    return ({
      name: this.name,
      description: this.description,
    });
  }

  getDefaultJSON(): LabelJSON {
    return DEFAULT_LABEL_JSON;
  }

  clone(): Label {
    return Label.build(this.toJSON());
  }

  getDefaultMappedJSON(): Defaults<LabelJSONMap> {
    return {
      "label": DEFAULT_LABEL_JSON,
    }
  }

  toPartialMappedJSON(): Partial<LabelJSONMap> {
    return {
      "label": {
        ...this.toJSON(),
      }
    }
  }
}
