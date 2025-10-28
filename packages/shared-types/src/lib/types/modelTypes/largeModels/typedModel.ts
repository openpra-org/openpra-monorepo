import Label from "../../Label";
import { BasicModel } from "../basicModel";

/**
 * JSON representation of a typed model.
 */
export interface TypedModelJSON {
  id: number;
  label: {
    name: string;
    description: string;
  };
  users: number[];
}

/**
 * Mapping from a typed model key to its JSON representation.
 */
export type TypedModelJSONMap = Record<string, TypedModelJSON>;

/**
 * Default placeholder JSON for a typed model.
 */
export const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON = {
  id: -1,
  label: {
    name: "",
    description: "",
  },
  users: [],
};

/**
 * Base model for all typed models that include a label, id, and collaborators (users).
 */
export default class TypedModel extends BasicModel /* implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  users: number[];

  /**
   * Build a TypedModel instance from JSON.
   * @param obj - Dictionary object to parse.
   */
  static build(obj: TypedModelJSON): TypedModel {
    return new TypedModel(obj.id, obj.label.name, obj.label.description, obj.users);
  }

  /**
   * Construct a typed model.
   * @param id - Model id (defaults to -1)
   * @param name - Model name.
   * @param description - Model description.
   * @param users - A list of user IDs.
   */
  constructor(id = -1, name = "", description = "", users: number[] = []) {
    super(new Label(name, description), id);
    this.users = users;
  }

  // Implement the getter and setter methods for ids
  getUsers(): number[] {
    return this.users;
  }

  /**
   * Set the list of collaborating users.
   * @param users - User id array.
   */
  setUsers(users: number[]): void {
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

/**
 * Mongoose-like document type for a typed model persisted in storage.
 */
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
}
