import { Controller, Post, Request, UseFilters, UseGuards, Body } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { LoginErrorFilter } from "../filters/login-error.filter";
import { User } from "../collab/schemas/user.schema";
import { AuthService } from "./auth.service";
@Controller()
@UseGuards(AuthGuard("local"))
@UseFilters(LoginErrorFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post("/token-obtain/")
  async loginUser(
    @Request()
    req: {
      user: User;
    },
  ): Promise<{
    token: string;
  }> {
    return this.authService.getJwtToken(req.user);
  }
  @Post("/verify-password/")
  async verifyPassword(
    @Body()
    body: {
      username: string;
      password: string;
    },
  ): Promise<{
    match: boolean;
  }> {
    const match = await this.authService.verifyPassword(body.username, body.password);
    return {
      match: match,
    };
  }
}
