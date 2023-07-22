import { Defaults } from "../../ObjectTypes";
import { Parsable } from "../../Parsable";
import { BasicModel } from "../basicModel";

export interface TypedModelJSON {
  name: string;
  description: string;
  users: number[];
}

export type TypedModelJSONMap = { [key: string]: TypedModelJSON };

export const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON = {
  name: '',
  description: '',
  users: []
};

export default class TypedModel extends BasicModel /** implements Parsable<TypedModelJSONMap, TypedModelJSON> */ {
  private users: number[];

  /**
   * @param {TypedModelJSON} obj - dictionary object to parse
   */
  static build(obj: TypedModelJSON): TypedModel {
    return new TypedModel(obj.name, obj.description);
  }

  /**
   * @param {string} name
   * @param {string} description
   * @param {number []} users a list of users represented by their id numbers
   */
  constructor(name = '', description = '', users: number[] = []) {
    super(name, description);
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
