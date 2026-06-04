import Label from "../../Label";
import { BasicModel } from "../basicModel";
export interface NestedModelJSON {
  label: {
    name: string;
    description: string;
  };
  parentIds: number[] | string[];
}
export const DefaultNestedModelJSON: NestedModelJSON = {
  label: {
    name: "",
    description: "",
  },
  parentIds: [],
};
export class NestedModel extends BasicModel {
  private readonly parentIds: number[];
  constructor(name = "", description = "", id = -1, parentIds: number[] = []) {
    super(new Label(name, description), id);
    this.parentIds = parentIds;
  }
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
export interface NestedModelType {
  _id: string;
  label: {
    name: string;
    description: string;
  };
  id: number;
  parentIds: string[];
}
