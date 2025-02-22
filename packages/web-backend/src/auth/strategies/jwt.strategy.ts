import * as fs from "fs";
import * as process from "process";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export const ParseJwtSecret = (configService: ConfigService): string => {
  // if the env-var for the secret key file has been set, read from it.
  if (process.env.JWT_SECRET_KEY_FILE) {
    return fs.readFileSync(configService.get<string>("JWT_SECRET_KEY_FILE")).toString();
  }
  // otherwise, read from the unsafe env-var
  console.warn("Setting the JWT secret as an environment variable is unsafe, use JWT_SECRET_KEY_FILE instead");
  const key = configService.get<string>("UNSAFE_JWT_SECRET_KEY");

  if (!process.env.UNSAFE_JWT_SECRET_KEY) {
    console.warn("Failed to fetch UNSAFE_JWT_SECRET_KEY");
  }
  return key;
};

/**
 * 1. The JWT Strategy (AuthGuard('jwt')) is going to extract the 'Authorization' property from the request header.
 *    The Authorization property has the format: 'JWT <token>'.
 *    This <token> is extracted and then the expiration is checked (the token expires 24 hours after it is generated).
 *    The encrypted information (the User object) from the token is decrypted using a 'secret key' known by the user only.
 *    The secret key is set as an environment variable ('UNSAFE_JWT_SECRET_KEY'). For dev envs, find it in '.develop.env'.
 * 2. After decrypting the User object, it is sent to the validate function where the User data (userID, username, email) is separated.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      ignoreExpiration: false,
      secretOrKey: ParseJwtSecret(configService),
    });
  }

  async validate(payload: any) {
    return {
      user_id: payload.user_id,
      username: payload.username,
      email: payload.email,
    };
  }
}
