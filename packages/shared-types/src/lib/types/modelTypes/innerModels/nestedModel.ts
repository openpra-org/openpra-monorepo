import Label from "../../Label";
import { BasicModel } from "../basicModel";

/** JSON input shape for creating/updating a nested model. */
export interface NestedModelJSON {
  label: {
    name: string;
    description: string;
  };
  parentIds: number[] | string[];
}

//maps the json
//export type TypedModelJSONMap = Record<string, NestedModelJSON>;

/** Default empty JSON for a nested model. */
export const DefaultNestedModelJSON: NestedModelJSON = {
  label: {
    name: "",
    description: "",
  },
  parentIds: [],
};

/**
 * Base nested model with label, id, and parent relationships to typed models.
 * Extends BasicModel with parentIds to track parent typed models.
 */
export class NestedModel extends BasicModel {
  //id number of the parent model
  private readonly parentIds: number[];

  /**
   * Construct a nested model with label metadata and parent associations.
   * @param name - name of the model
   * @param description - description of the model
   * @param id - the id of the current model
   * @param parentIds - the id of the parent model this is attached to
   */
  constructor(name = "", description = "", id = -1, parentIds: number[] = []) {
    super(new Label(name, description), id);
    this.parentIds = parentIds;
  }

  /**
   * Build a NestedModel from its JSON form.
   *
   * @param obj - Source JSON with label and parentIds
   * @returns Constructed NestedModel instance
   */
  static build(obj: NestedModelJSON): NestedModel {
    return new NestedModel(obj.label.name, obj.label.description);
  }

  /**
   * Get the parent typed model identifiers.
   * @returns Array of parent ids for this nested model.
   */
  getParent(): number[] {
    return this.parentIds;
  }

  /**
   * Add a parent typed model id reference.
   *
   * @param parentId - Identifier of the parent typed model to associate
   */
  addParent(parentId: number): void {
    this.parentIds.push(parentId);
  }
}

/**
 * Mongoose-like document representation for persisted nested models.
 */
export interface NestedModelType {
  _id: string;
  label: {
    name: string;
    description: string;
  };
  id: number;
  parentIds: string[];
}
