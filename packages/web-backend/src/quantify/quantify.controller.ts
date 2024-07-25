import {Controller, Post, Body } from "@nestjs/common";
import { QuantifyService } from "./quantify.service";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}
