import { Controller } from "@nestjs/common";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { TypedBody, TypedRoute } from "@nestia/core";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyService } from "./quantify.service";

@Controller()
export class QuantifyController {
  constructor(private readonly quantifyService: QuantifyService) {}

  @TypedRoute.Post("/with-scram-binary/")
  async withScramBinary(@TypedBody() body: QuantifyRequest): Promise<QuantifyReport> {
    return this.quantifyService.usingScramBinary(body);
  }
}
