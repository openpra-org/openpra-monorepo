import * as fs from "fs";
import * as process from "process";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
interface JwtPayload {
  user_id?: unknown;
  username?: unknown;
  email?: unknown;
}
export const ParseJwtSecret = (configService: ConfigService): string => {
  if (process.env.JWT_SECRET_KEY_FILE) {
    return fs.readFileSync(configService.get<string>("JWT_SECRET_KEY_FILE")).toString();
  }
  console.warn("Setting the JWT secret as an environment variable is unsafe, use JWT_SECRET_KEY_FILE instead");
  const key = configService.get<string>("UNSAFE_JWT_SECRET_KEY");
  if (!process.env.UNSAFE_JWT_SECRET_KEY) {
    console.warn("Failed to fetch UNSAFE_JWT_SECRET_KEY");
  }
  return key;
};
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      ignoreExpiration: false,
      secretOrKey: ParseJwtSecret(configService),
    });
  }
  validate(payload: JwtPayload) {
    const user_id =
      typeof payload.user_id === "number" ? payload.user_id
      : typeof payload.user_id === "string" ? Number(payload.user_id)
      : undefined;
    const username = typeof payload.username === "string" ? payload.username : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    return { user_id, username, email };
  }
}
