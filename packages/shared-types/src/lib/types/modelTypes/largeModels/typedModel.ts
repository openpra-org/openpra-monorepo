import Label from "../../Label";
import { BasicModel } from "../basicModel";

export interface TypedModelJSON {
  id: number;
  label: {
    name: string;
    description: string;
  };
  users: number[];
}

export type TypedModelJSONMap = Record<string, TypedModelJSON>;

export const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON = {
  id: -1,
  label: {
    name: "",
    description: "",
  },
  users: [],
};

export default class TypedModel extends BasicModel /* implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  users: number[];

  static build(obj: TypedModelJSON): TypedModel {
    return new TypedModel(obj.id, obj.label.name, obj.label.description, obj.users);
  }

  constructor(id = -1, name = "", description = "", users: number[] = []) {
    super(new Label(name, description), id);
    this.users = users;
  }

  getUsers(): number[] {
    return this.users;
  }

  setUsers(users: number[]): void {
    this.users = users;
  }
}

export interface typedModelType {
  _id: string;
  label: {
    name: string;
    description: string;
  };
  users: number[];
  initiatingEvents: string[];
  eventSequenceDiagrams: string[];
  eventSequenceAnalysis: string[];
  functionalEvents?: string[];
  eventTrees: string[];
  faultTrees: string[];
  bayesianNetworks: string[];
  markovChains?: string[];
  bayesianEstimations?: string[];
  weibullAnalysis?: string[];
  id: number;
  createdAt?: string;
  updatedAt?: string;
}
