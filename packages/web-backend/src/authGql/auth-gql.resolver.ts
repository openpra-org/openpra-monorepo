import { Args, Context, Mutation, Resolver } from "@nestjs/graphql";
import { ExecutionContext, UseGuards } from "@nestjs/common";
import { User } from "../users/entities/user.entity";
import { ClientUser } from "../users/entities/clientUser.entity";
import { AuthGqlService } from "./auth-gql.service";
import { LoginResponse } from "./dto/login-response";
import { LoginUserInput } from "./dto/login-user.input";
import { AuthGqlGuard } from "./auth-gql.guard";

// Setting the type of the GraphQL context to have user.
type UserContext = {
  user: User;
};

/**
 * @public Handles the login and signup requests coming from the client.
 * */
@Resolver()
export class AuthGqlResolver {
  /**
   * @remarks Constructs an AuthGqlResolver object.
   * @param authGqlService - Instance of AuthGqlService to handle login and signup.
   * */
  constructor(private readonly authGqlService: AuthGqlService) {}

  /**
   * @remarks Handles login request from the client. AuthGqlGuard validates the credentials. Once verified, a JWT is generated and returned.
   * @param loginUserInput - Contains the username and password sent by the client.
   * @param context - Execution context of the current request. The User object is added to the context after validation by Passport.
   * @returns LoginResponse object containing the JWT and User.
   * */
  @Mutation(() => LoginResponse)
  @UseGuards(AuthGqlGuard)
  login(
    @Args("loginUserInput") loginUserInput: LoginUserInput,
    @Context() context: UserContext,
  ): LoginResponse {
    return this.authGqlService.login(context.user);
  }

  /**
   * @remarks Handles sign up request from the client
   * @param loginUserInput - Contains the username and password that client wants to create.
   * @returns ClientUser object containing the ID and username of the created User object if sign up was successful. Undefined otherwise.
   * */
  @Mutation(() => User)
  signup(
    @Args("loginUserInput") loginUserInput: LoginUserInput,
  ): Promise<ClientUser> | undefined {
    return this.authGqlService.signup(loginUserInput);
  }
}
