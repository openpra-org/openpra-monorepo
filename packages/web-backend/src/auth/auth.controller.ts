import { Controller, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TypedRoute, TypedHeaders, TypedBody } from "@nestia/core";
import { UserType } from "shared-types/src/openpra-mef/collab/user";
import { AuthService } from "./auth.service";

@Controller()
@UseGuards(AuthGuard("local"))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @param req - Express request object @see {@link https://expressjs.com/en/api.html#req}
   * @example Request body sample:
   * {
   *   "username": "Ed",
   *   "password": "WinryRockbell"
   * }
   * @returns JWT token
   * @example POST request -> https://staging.app.openpra.org/api/auth/token-obtain
   */
  @TypedRoute.Post("/token-obtain/")
  public async loginUser(@TypedHeaders() req: { user: UserType }): Promise<{ token: string }> {
    return this.authService.getJwtToken(req.user);
  }

  /**
   * This is a helper api call which will return true if password which user provides matches with the database
   *
   * @param body - The request should contain two keys username and password
   * @example Request body example
   * {
   *   "username" : "Ed"
   *   "password" : "FullMetalAlchemist"
   * }
   */
  @TypedRoute.Post("/verify-password/")
  public async verifyPassword(@TypedBody() body: { username: string; password: string }): Promise<{ match: boolean }> {
    const match = await this.authService.verifyPassword(body.username, body.password);
    return {
      match: match,
    };
  }
}
