import Label from "../../Label";
import { BasicModel } from "../basicModel";

//interface that will maybe be used to pass partials to the database
export interface NestedModelJSON {
  label:{
    name: string;
    description: string;
  }
  parentIds: number[]
}

//maps the json
export type TypedModelJSONMap = { [key: string]: NestedModelJSON };

//creates the default JSON object
export const DEFAULT_NESTED_MODEL_JSON: NestedModelJSON = {
  label:{
    name: '',
    description: ''
  },
  parentIds: []
};

// exports a class called nested model, this extends basic model and has additional functionality to track the model which this is assigned to,
// works similarly to how the other models work, but instead of a user its a model its attached to and will be loaded from
export default class NestedModel extends BasicModel /** implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  
  //id number of the parent model
  private parentIds: number[];

  /**
   * @param {TypedModelJSON} obj - dictionary object to parse
   */
  static build(obj: NestedModelJSON): NestedModel {
    return new NestedModel(obj.label.name, obj.label.description);
  }

  /**
   * @param {string} name name of the model
   * @param {string} description description of the model
   * @param {number} id the id of the current model
   * @param {number} parentId the id of the parent model this is attached to
   */
  constructor(name = '', description = '', id = -1, parentIds = []) {
    super(new Label(name, description), id);
    this.parentIds = parentIds
  }

  getParent(): number[] {
    return this.parentIds
  }

  addParent(parentId: number) {
    this.parentIds.push(parentId)
  }
}
