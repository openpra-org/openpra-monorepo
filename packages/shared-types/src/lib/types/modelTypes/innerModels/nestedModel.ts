import Label from "../../Label";
import { BasicModel } from "../basicModel";

//interface that will maybe be used to pass partials to the database
export type NestedModelJSON = {
  label: {
    name: string;
    description: string;
  };
  parentIds: number[];
};

//maps the json
//export type TypedModelJSONMap = Record<string, NestedModelJSON>;

//creates the default JSON object
export const DefaultNestedModelJSON: NestedModelJSON = {
  label: {
    name: "",
    description: "",
  },
  parentIds: [],
};

// exports a class called nested model, this extends basic model and has additional functionality to track the model which this is assigned to,
// works similarly to how the other models work, but instead of a user its a model its attached to and will be loaded from
export class NestedModel extends BasicModel {
  //id number of the parent model
  private readonly parentIds: number[];

  /**
   * @param name - name of the model
   * @param description - description of the model
   * @param id - the id of the current model
   * @param parentIds - the id of the parent model this is attached to
   */
  constructor(name = "", description = "", id = -1, parentIds = []) {
    super(new Label(name, description), id);
    this.parentIds = parentIds;
  }

  /**
   * @param obj - dictionary object to parse
   */
  static build(obj: NestedModelJSON): NestedModel {
    return new NestedModel(obj.label.name, obj.label.description);
  }

  getParent(): number[] {
    return this.parentIds;
  }

  addParent(parentId: number): void {
    this.parentIds.push(parentId);
  }
}
