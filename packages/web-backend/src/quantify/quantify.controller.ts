import { Controller, Post, Body } from "@nestjs/common";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { Report } from "shared-types/src/openpra-mef/util/report"
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @Post("/scram-node")
  async quantifyModel(@Body() requestBody: NodeQuantRequest): Promise<Report> {
    return this.quantifyService.quantifyModel(requestBody);
  }

  @Post("/with-scram-binary/")
  async withScramBinary(@Body() req): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(req);
  }
}
