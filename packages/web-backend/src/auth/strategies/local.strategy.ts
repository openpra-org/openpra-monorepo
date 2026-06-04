import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { User } from "../../collab/schemas/user.schema";
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, "local") {
  constructor(private readonly authService: AuthService) {
    super();
  }
  async validate(username: string, password: string): Promise<User | UnauthorizedException> {
    const user = await this.authService.loginUser(username, password);
    if (!user) {
      throw new UnauthorizedException("Invalid user credentials");
    }
    return user;
  }
}
