import { Controller, Post, Request, UseFilters, UseGuards, Body } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { LoginErrorFilter } from "../filters/login-error.filter";
import { User } from "../collab/schemas/user.schema";
import { AuthService } from "./auth.service";

/**
 * Controller for authentication endpoints.
 * Provides token issuance and credential verification APIs.
 * @public
 */
@Controller()
@UseGuards(AuthGuard("local"))
@UseFilters(LoginErrorFilter)
export class AuthController {
  /**
   * @param authService Service handling user auth and JWT issuance.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Handles user login and returns a JWT token.
   *
   * @param req - Express request object. See {@link https://expressjs.com/en/api.html#req}.
   * @example
   * Request body sample:
   * \{
   *   "username": "Ed",
   *   "password": "WinryRockbell"
   * \}
   * @returns JWT token
   * @example
   * POST request: https://staging.app.openpra.org/api/auth/token-obtain
   */
  @Post("/token-obtain/")
  async loginUser(@Request() req: { user: User }): Promise<{ token: string }> {
    return this.authService.getJwtToken(req.user);
  }

  /**
   * Verifies if the provided password matches the database for the given user.
   *
   * @param body - The request should contain two keys: username and password.
   * @returns Whether the provided password matches for the given username.
   * @example
   * Request body example:
   * \{
   *   "username": "Ed",
   *   "password": "FullMetalAlchemist"
   * \}
   */
  @Post("/verify-password/")
  async verifyPassword(@Body() body: { username: string; password: string }): Promise<{ match: boolean }> {
    const match = await this.authService.verifyPassword(body.username, body.password);
    return {
      match: match,
    };
  }
}
