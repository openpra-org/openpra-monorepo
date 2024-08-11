import typia, { tags } from "typia";

export interface NewUser {
  firstName: string & tags.MinLength<1> & tags.MaxLength<255>;
  lastName: string & tags.MinLength<1> & tags.MaxLength<255>;
  username: string & tags.MinLength<1> & tags.MaxLength<255>;
  email: string & tags.MinLength<5> & tags.MaxLength<255>;
  password: string & tags.MinLength<1> & tags.MaxLength<255>;
  roles: string[] & tags.MinLength<1> & tags.MaxLength<3>;
}

export const NewUserSchema = typia.json.application<[NewUser], "3.0">();
