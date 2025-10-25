import { Controller, Post, Body } from "@nestjs/common";
import type { QuantifyReport } from "mef-types/openpra-mef/util/quantify-report";
import { QuantifyService } from "./quantify.service";
import type { QuantifyRequest } from "mef-types/openpra-mef/util/quantify-request";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req: QuantifyRequest): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}
