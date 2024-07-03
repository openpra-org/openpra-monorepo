import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { GqlExecutionContext } from "@nestjs/graphql";
import { HTTPGraphQLRequest } from "@apollo/server";

// Setting the type of the GraphQL context.
type GraphQLContext = {
  req: HTTPGraphQLRequest;
};

/**
 * @public Extracts the request from ExecutionContext.
 * */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  /**
   * @remarks Extracts the request from ExecutionContext.
   * @param context - Execution context of the GraphQL request from the client.
   * @returns HTTPGraphQLRequest object containing the properties of the request.
   * */
  getRequest(context: ExecutionContext): HTTPGraphQLRequest {
    const ctx = GqlExecutionContext.create(context);
    const graphqlContext = ctx.getContext<GraphQLContext>();
    return graphqlContext.req;
  }
}
