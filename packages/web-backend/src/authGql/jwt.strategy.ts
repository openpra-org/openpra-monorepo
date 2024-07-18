import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ClientUser } from "../users/entities/clientUser.entity";

// Setting the type of the payload passed to the validate method.
interface Payload {
  username: string;
  sub: string;
}

/**
 * @public JwtStrategy handles the validation of the JWT provided by the client.
 * */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * @remarks Extracts the JWT and validates it using the secret.
   * */
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: "temp",
    });
  }

  /**
   * @remarks Acts as an adapter to translate the payload given by Passport into ClientUser object
   * @param payload - Contains the ID and username obtained from the JWT.
   * @returns ClientUser object containing ID and username.
   * */
  validate(payload: Payload): ClientUser {
    return { _id: payload.sub, username: payload.username };
  }
}
