import { ObjectType, Field, ID } from "@nestjs/graphql";
import { ObjectId } from "mongoose";

/**
 * This contains all the attributes of the User entity that will be sent to the client side
 * */
@ObjectType()
export class ClientUser {
  @Field(() => ID)
  _id: string;

  @Field()
  username: string;
}
