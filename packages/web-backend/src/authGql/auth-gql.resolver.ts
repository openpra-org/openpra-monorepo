import { Args, Context, Mutation, Resolver } from "@nestjs/graphql";
import { ExecutionContext, UseGuards } from "@nestjs/common";
import { User } from "../users/entities/user.entity";
import { ClientUser } from "../users/entities/clientUser.entity";
import { AuthGqlService } from "./auth-gql.service";
import { LoginResponse } from "./dto/login-response";
import { LoginUserInput } from "./dto/login-user.input";
import { AuthGqlGuard } from "./auth-gql.guard";

@Resolver()
export class AuthGqlResolver {
  constructor(private readonly authGqlService: AuthGqlService) {}

  @Mutation(() => LoginResponse)
  @UseGuards(AuthGqlGuard)
  login(
    @Args("loginUserInput") loginUserInput: LoginUserInput,
    @Context() context,
  ): LoginResponse {
    return this.authGqlService.login(context.user);
  }

  @Mutation(() => User)
  signup(
    @Args("loginUserInput") loginUserInput: LoginUserInput,
  ): Promise<ClientUser> | undefined {
    return this.authGqlService.signup(loginUserInput);
  }
}
