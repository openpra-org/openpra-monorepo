import { Controller, Post, Request, UseFilters, UseGuards, Body, Get, Req, Res } from "@nestjs/common";
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
@UseFilters(LoginErrorFilter)
export class AuthController {
  /**
   * Construct the controller with the authentication service.
   * @param authService - Service handling user auth and JWT issuance.
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
  @UseGuards(AuthGuard("local"))
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
  @UseGuards(AuthGuard("local"))
  async verifyPassword(@Body() body: { username: string; password: string }): Promise<{ match: boolean }> {
    const match = await this.authService.verifyPassword(body.username, body.password);
    return {
      match: match,
    };
  }

  /**
   * Initiates Google OAuth flow.
   * Redirects user to Google's consent screen.
   */
  @Get("/google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Guard redirects to Google
  }

  /**
   * Google OAuth callback endpoint.
   * Handles the redirect from Google after authentication.
   *
   * IMPORTANT: This is where the JWT token is generated and returned!
   * After OAuth validation, we:
   * 1. Validate/find the user in our database
   * 2. Generate a JWT token using getJwtToken()
   * 3. Return it to the frontend (either as JSON or redirect with token)
   */
  @Get("/google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req: { user: any }): Promise<{ token: string }> {
    // Step 1: Validate OAuth user (find or create in database)
    const user = await this.authService.validateOAuthUser(req.user);

    // Step 2: Generate JWT token (same as regular login)
    // Returns { token: string } in response body, matching local strategy
    return this.authService.getJwtToken(user);
  }
}
