import { ObjectType, Field, Int } from "@nestjs/graphql";

/**
 * This contains all the attributes of the User entity
 * */
@ObjectType()
export class ClientUser {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;
}
