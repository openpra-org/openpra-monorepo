import Label from "../../Label";
import { BasicModel } from "../basicModel";

export type TypedModelJSON = {
  id: number;
  label: {
    name: string;
    description: string;
  };
  users: number[];
};

export type TypedModelJSONMap = Record<string, TypedModelJSON>;

export const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON = {
  id: -1,
  label: {
    name: "",
    description: "",
  },
  users: [],
};

export default class TypedModel extends BasicModel /** implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  users: number[];

  /**
   * @param {TypedModelJSON} obj - dictionary object to parse
   */
  static build(obj: TypedModelJSON): TypedModel {
    return new TypedModel(
      obj.id,
      obj.label.name,
      obj.label.description,
      obj.users,
    );
  }

  /**
   * @param {string} name
   * @param {string} description
   * @param {number []} users a list of users represented by their id numbers
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
   * @param {number []} users sets the users
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
