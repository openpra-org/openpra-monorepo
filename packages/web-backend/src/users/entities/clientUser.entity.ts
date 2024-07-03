import { ObjectType, Field, Int } from "@nestjs/graphql";

/**
 * This contains all the attributes of the User entit
 * */
@ObjectType()
export class ClientUser {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;
}
