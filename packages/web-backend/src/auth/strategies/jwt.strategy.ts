import * as fs from "fs";
import * as process from "process";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import * as jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

/**
 * 1. The JWT/OIDC Hybrid Strategy implements a dual authentication approach:
 *    a) First attempts JWT validation:
 *       - Extracts 'Authorization' header with format 'JWT <token>'
 *       - Validates token using local JWT secret key from environment variable ('JWT_SECRET_KEY')
 *       - For deployment, reads key from file system; otherwise uses direct environment variable
 *       - Verifies token expiration and signature using HS256 algorithm
 *
 *    b) Falls back to OIDC validation if JWT fails:
 *       - Extracts Key ID (kid) from token header
 *       - Fetches corresponding public key from OIDC provider's JWKS endpoint
 *       - Validates token using RS256 algorithm and fetched public key
 *       - Maintains cached JWKS keys to optimize performance
 *
 * 2. After successful validation (either JWT or OIDC):
 *    - Decoded payload is passed to validate function
 *    - Extracts and returns user information (user_id, username, email)
 *    - Provides detailed logging throughout the validation process
 *
 * Note: Strategy supports both HS256 (for local JWT) and RS256 (for OIDC) algorithms
 *       and automatically determines the appropriate validation method based on the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  private readonly jwksClient;
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        try {
          const secretKey = process.env.DEPLOYMENT
            ? fs.readFileSync(configService.get<string>("JWT_SECRET_KEY")).toString()
            : configService.get<string>("JWT_SECRET_KEY");

          try {
            jwt.verify(rawJwtToken, secretKey, {
              algorithms: ["HS256"],
            });
            return done(null, secretKey);
          } catch (verifyError) {
            throw verifyError;
          }
        } catch (jwtError) {
          try {
            const decodedToken = jwt.decode(rawJwtToken, { complete: true }) as any;
            if (!decodedToken?.header?.kid) {
              throw new Error("Invalid token: missing 'kid' in header");
            }

            const key = await this.getSigningKey(decodedToken.header.kid);
            return done(null, key);
          } catch (oidcError) {
            return done(oidcError);
          }
        }
      },
      algorithms: ["HS256", "RS256"], // Support both algorithms
    });

    this.jwksClient = jwksClient({
      jwksUri: "https://hub.openpra.org/hub/api/rest/oauth2/keys",
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 86400000,
    });
  }

  private async getSigningKey(kid: string): Promise<string> {
    const key = await this.jwksClient.getSigningKey(kid);
    return key.getPublicKey();
  }

  async validate(payload: any) {
    return {
      user_id: payload.user_id,
      username: payload.username,
      email: payload.email,
    };
  }
}
