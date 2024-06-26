import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ClientUser } from "../users/entities/clientUser.entity";

type Payload = {
  username: string;
  sub: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: "temp",
    });
  }

  validate(payload: Payload): ClientUser {
    return { id: payload.sub, username: payload.username };
  }
}
