import { ObjectType, Field, Int } from "@nestjs/graphql";

/**
 * This contains all the attributes of the User entity that will be sent to the client side
 * */
@ObjectType()
export class ClientUser {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;
}
