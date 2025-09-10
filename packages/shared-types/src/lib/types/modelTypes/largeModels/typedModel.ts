import Label from "../../Label";
import { BasicModel } from "../basicModel";

function generateId(length: number = 6): string {
  return Math.random().toString(36).substring(2, length + 2);
}

export interface TypedModelJSON {
  id: string;
  label: {
    name: string;
    description: string;
  };
  users: string[];
}

export type TypedModelJSONMap = Record<string, TypedModelJSON>;

export const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON = {
  id: generateId(),
  label: {
    name: "",
    description: "",
  },
  users: [],
};

export default class TypedModel extends BasicModel /** implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  users: string[];

  /**
   * @param {TypedModelJSON} obj - dictionary object to parse
   */
  static build(obj: TypedModelJSON): TypedModel {
    return new TypedModel(obj.id, obj.label.name, obj.label.description, obj.users);
  }

  /**
   * @param {string} name
   * @param {string} description
   * @param {number []} users a list of users represented by their id numbers
   */
  constructor(id = generateId(), name = "", description = "", users: string[] = []) {
    super(new Label(name, description), id);
    this.users = users;
  }

  // Implement the getter and setter methods for ids
  getUsers(): string[] {
    return this.users;
  }

  /**
   * @param {number []} users sets the users
   */
  setUsers(users: string[]): void {
    this.users = users;
  }

  // getTypeString(): string {
  //   if (this instanceof ExternalHazardsModel) {
  //     return "external-hazards";
  //   } else if (this instanceof InternalEventsModel) {
  //     return 'internal-events';
  //   } else if (this instanceof FullScopeModel) {
  //     return 'full-scope';
  //   } else if (this instanceof InternalHazardsModel) {
  //     return 'internal-hazards'
  //   } else {
  //     return "No Type";
  //   }
  // }

  // toJSON(): TypedModelJSON {
  //   return {
  //     name: this.getName(),
  //     description: this.getDescription(),
  //     users: this.getUsers()
  //   };
  // }

  // getDefaultJSON(): TypedModelJSON {
  //   return DEFAULT_TYPED_MODEL_JSON;
  // }

  // clone(): TypedModel {
  //   return TypedModel.build(this.toJSON());
  // }

  // getDefaultMappedJSON(): Defaults<TypedModelJSONMap> {
  //   return {
  //     "typedModel": DEFAULT_TYPED_MODEL_JSON,
  //   };
  // }

  // toPartialMappedJSON(): Partial<TypedModelJSONMap> {
  //   return {
  //     "typedModel": {
  //       ...this.toJSON(),
  //     },
  //   };
  // }
}

export interface typedModelType {
  id: string;
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
}
