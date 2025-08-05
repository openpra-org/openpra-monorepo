import { Body, Controller, Post } from "@nestjs/common";
import { ResetPasswordService } from "./reset.service";
import { RequestResetPasswordDto } from "./dto/request-reset-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("api/forgot")
export class ResetController {
  constructor(private readonly resetService: ResetPasswordService) {}

  @Post("request-reset-password")
  async requestReset(@Body() body: RequestResetPasswordDto) {
    await this.resetService.requestPasswordReset(body.email);
    return { message: "If an account with that email exists, a reset link has been sent." };
  }

  @Post("reset-password")
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.resetService.resetPassword(body.token, body.newPassword);
    return { message: "Password reset successful." };
  }
}
