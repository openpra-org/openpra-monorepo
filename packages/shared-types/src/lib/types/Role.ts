import {Parsable} from "./Parsable";
import { LabelJSON } from "./Label";

export enum ROLE_CHOICES {
  PUBLIC = "public",
  PRIVATE = "private",
}

export interface RoleJSON {
  role?: ROLE_CHOICES;
}

const DEFAULT: RoleJSON = {
  role: ROLE_CHOICES.PUBLIC,
};

export type RoleJSONMap = {[key: string]: LabelJSON};

export class Role implements Parsable<RoleJSONMap, RoleJSON> {
  role: ROLE_CHOICES;

  constructor(role: ROLE_CHOICES = ROLE_CHOICES.PUBLIC) {
    this.role = role;
  }

  getDefaultJSON(): RoleJSON {
    return DEFAULT;
  }

  toJSON(): RoleJSON {
    return {
      role: this.role,
    };
  }

}
