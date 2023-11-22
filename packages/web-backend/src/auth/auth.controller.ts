import {
  Controller,
  Post,
  Request,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { LoginErrorFilter } from "../filters/login-error.filter";
import { AuthService } from "./auth.service";

@Controller()
@UseGuards(AuthGuard("local"))
@UseFilters(LoginErrorFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
   * @example Request body sample:
   * {
   *   "username": "Ed",
   *   "password": "WinryRockbell"
   * }
   * @returns JWT token
   * @example POST request -> https://staging.app.openpra.org/api/auth/token-obtain
   */
  @Post("/token-obtain/")
  async loginUser(@Request() req): Promise<{ token: string }> {
    return this.authService.getJwtToken(req.user);
  }
}
