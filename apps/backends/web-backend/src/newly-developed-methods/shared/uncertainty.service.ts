import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  UncertaintyRequestSchema,
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { PraetorAnalysisClient } from "./praetor-analysis.client";

@Injectable()
class UncertaintyService {
  constructor(private readonly praetor: PraetorAnalysisClient) {}

  async evaluate(body: UncertaintyRequest): Promise<UncertaintyResponse> {
    const parsed = UncertaintyRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const response = await this.praetor.execute({
      schemaVersion: "1.0.0",
      request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...parsed.data },
      modelSnapshots: [],
    });
    if (response.error !== undefined) {
      if (response.error.code === "PRAXIS_BUSY") throw new ServiceUnavailableException(response.error.message);
      throw new BadRequestException(response.error.message);
    }
    const answer = response.result;
    const result = UncertaintyResponseSchema.safeParse({
      laws: answer?.["laws"],
      expressions: answer?.["expressions"],
      operations: answer?.["operations"],
    });
    if (!result.success) throw new BadGatewayException(`PRAXIS returned an invalid uncertainty result: ${result.error.message}`);
    return result.data;
  }
}

export { UncertaintyService };
