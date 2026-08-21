import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";

import { runPraxisWithWorker } from "../workers/praxis-worker-runner";

type PraxisNativeOperation = "validate" | "execute";
type PraxisNativeResponse = Record<string, unknown>;

@Injectable()
class PraxisNativeService {
  async run(operation: PraxisNativeOperation, request: unknown): Promise<PraxisNativeResponse> {
    const requestJson = JSON.stringify(request);
    if (requestJson === undefined) {
      throw new BadRequestException("A versioned PRAXIS request body is required.");
    }

    let resultJson: string;
    try {
      ({ resultJson } = await runPraxisWithWorker({ operation, requestJson }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`PRAXIS worker execution failed: ${message}`);
    }

    try {
      const response: unknown = JSON.parse(resultJson);
      if (typeof response !== "object" || response === null || Array.isArray(response)) {
        throw new Error("response is not a JSON object");
      }
      return response as PraxisNativeResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`PRAXIS worker returned invalid JSON: ${message}`);
    }
  }
}

export { PraxisNativeService };
export type { PraxisNativeOperation, PraxisNativeResponse };
