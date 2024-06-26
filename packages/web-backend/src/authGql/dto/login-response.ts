import { Field, ObjectType } from "@nestjs/graphql";
import { ClientUser } from "../../users/entities/clientUser.entity";

@ObjectType()
export class LoginResponse {
  @Field()
  access_token: string;

  @Field(() => ClientUser)
  user: ClientUser;
}
