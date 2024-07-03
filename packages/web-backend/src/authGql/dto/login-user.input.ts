import { Field, InputType } from "@nestjs/graphql";

/**
 * Input Type object defining the parameters to be passed for login.
 * */
@InputType()
export class LoginUserInput {
  @Field()
  username: string;

  @Field()
  password: string;
}
