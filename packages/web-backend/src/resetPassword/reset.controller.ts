import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ResetPasswordService } from "./reset.service";
import { RequestResetPasswordDto } from "./dto/request-reset-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { EmailThrottlerGuard } from '../guards/email-throttler.guard';
import { Throttle } from '@nestjs/throttler';

@Controller("api/forgot")
export class ResetController {
  constructor(private readonly resetService: ResetPasswordService) {}

  @Post("request-reset-password")
  @UseGuards(EmailThrottlerGuard)
  @Throttle({default: {ttl: 3_600_000, limit: 3}})
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
