import { InputType, Field } from "@nestjs/graphql";

/**
 * Input Type defining the parameters to be passed from client side for creating a user
 * */
@InputType()
export class CreateUserInput {
  @Field()
  username: string;

  @Field()
  password: string;
}
