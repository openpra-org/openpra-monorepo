import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { HTTPGraphQLRequest } from "@apollo/server";
import { GqlExecutionContext } from "@nestjs/graphql";
import { LoginUserInput } from "./dto/login-user.input";

type GraphQLArguments = {
  loginUserInput: LoginUserInput;
};

@Injectable()
export class AuthGqlGuard extends AuthGuard("local") {
  getRequest(context: ExecutionContext): HTTPGraphQLRequest {
    const ctx: GqlExecutionContext = GqlExecutionContext.create(context);
    const args = ctx.getArgs<GraphQLArguments>();
    const request: HTTPGraphQLRequest = ctx.getContext();
    request.body = args.loginUserInput;
    return request;
  }
}
