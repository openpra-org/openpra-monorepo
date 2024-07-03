import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { ClientUser } from "../users/entities/clientUser.entity";
import { AuthGqlService } from "./auth-gql.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authGqlService: AuthGqlService) {
    super();
  }
  validate(username: string, password: string): Promise<ClientUser> {
    const user = this.authGqlService.validateUser(username, password);

    if (user === undefined) {
      throw new UnauthorizedException("Incorrect username or password");
    }
    return user;
  }
}
