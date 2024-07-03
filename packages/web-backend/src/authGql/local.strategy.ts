import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { ClientUser } from "../users/entities/clientUser.entity";
import { AuthGqlService } from "./auth-gql.service";

/**
 * @public Handles the validation of user credentials.
 * */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  /**
   * @param authGqlService - Contains business logic for login, sign up and validation
   * */
  constructor(private readonly authGqlService: AuthGqlService) {
    super();
  }

  /**
   * @remarks Calls authGqlService to find a user having the same username and validate credentials. If user does not exist undefined will be returned and UnauthorizedException will be thrown.
   * @param username - Username provided by the client.
   * @param password - Password provided by the client.
   * @returns ClientUser object is user was found and the credentials are valid. Otherwise an UnauthorizedException will be thrown.
   * */
  validate(username: string, password: string): Promise<ClientUser> {
    const user = this.authGqlService.validateUser(username, password);

    if (user === undefined) {
      throw new UnauthorizedException("Incorrect username or password");
    }
    return user;
  }
}
