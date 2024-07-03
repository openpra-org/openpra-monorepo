import { Field, ObjectType } from "@nestjs/graphql";
import { ClientUser } from "../../users/entities/clientUser.entity";

/**
 * Object type returned to client after successful authentication. Contains the generated JWT and ClientUser object.
 * */
@ObjectType()
export class LoginResponse {
  @Field()
  access_token: string;

  @Field(() => ClientUser)
  user: ClientUser;
}
