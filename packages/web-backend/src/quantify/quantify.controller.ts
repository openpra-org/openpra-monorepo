import { Controller, Post, Body } from "@nestjs/common";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() body: QuantifyRequest): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(body);
  }
}
