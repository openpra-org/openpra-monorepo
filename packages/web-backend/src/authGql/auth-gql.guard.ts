import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { HTTPGraphQLRequest } from "@apollo/server";
import { GqlExecutionContext } from "@nestjs/graphql";
import { LoginUserInput } from "./dto/login-user.input";

// Setting the type of the arguments present in the GraphQL request
type GraphQLArguments = {
  loginUserInput: LoginUserInput;
};

/**
 * @public AuthGqlGuard extends the local AuthGuard strategy and contains logic to extract the parameters passed from the client.
 * */
@Injectable()
export class AuthGqlGuard extends AuthGuard("local") {
  /**
   * @remarks Extracts the LoginUserInput object passed by the client and Stores it in a HTTPGraphQlRequest object.
   * @param context - ExecutionContext of the triggered request.
   * @returns HTTPGraphQLRequest object containing the username and password as body of the request.
   * */
  getRequest(context: ExecutionContext): HTTPGraphQLRequest {
    const ctx: GqlExecutionContext = GqlExecutionContext.create(context);
    const args = ctx.getArgs<GraphQLArguments>();
    const request: HTTPGraphQLRequest = ctx.getContext();
    request.body = args.loginUserInput;
    return request;
  }
}
