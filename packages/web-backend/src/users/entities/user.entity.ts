import { ObjectType, Field, ID } from "@nestjs/graphql";

/**
 * This contains all the attributes of the User entity
 * */
@ObjectType()
export class UserType {
  @Field(() => ID)
  _id: string;

  @Field()
  username: string;

  @Field()
  password: string;
}
