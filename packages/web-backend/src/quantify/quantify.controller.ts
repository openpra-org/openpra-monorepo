import { Controller, Post, Body } from "@nestjs/common";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}
