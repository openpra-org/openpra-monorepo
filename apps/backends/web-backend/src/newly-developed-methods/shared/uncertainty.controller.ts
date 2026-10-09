import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type { UncertaintyRequest, UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { UncertaintyService } from "./uncertainty.service";

@Controller("uncertainty")
@UseGuards(JwtAuthGuard)
class UncertaintyController {
  constructor(private readonly uncertaintyService: UncertaintyService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  evaluate(@Body() body: UncertaintyRequest): Promise<UncertaintyResponse> {
    return this.uncertaintyService.evaluate(body);
  }
}

export { UncertaintyController };
