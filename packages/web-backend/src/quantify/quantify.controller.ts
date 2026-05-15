import { Controller, Post, Body } from "@nestjs/common";
import type { QuantifyReport } from "shared-types";
import { QuantifyService } from "./quantify.service";
import type { QuantifyRequest } from "shared-types";
@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}
  @Post("/with-scram-binary/")
  async withScramBinary(
    @Body()
    req: QuantifyRequest,
  ): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}
