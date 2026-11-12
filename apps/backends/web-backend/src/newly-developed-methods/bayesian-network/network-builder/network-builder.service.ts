import { BadRequestException, Injectable } from "@nestjs/common";
import {
  BayesianNetworkBuilderRequestSchema,
  type BayesianNetworkBuilderRequest,
  type BayesianNetworkBuilderResponse,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { NetworkBuilderError } from "./core/errors";
import { parseSpecText } from "./core/spec-text";
import { buildNetwork } from "./network-builder";

@Injectable()
class NetworkBuilderService {
  build(body: BayesianNetworkBuilderRequest): BayesianNetworkBuilderResponse {
    const parsed = BayesianNetworkBuilderRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    try {
      const document = parseSpecText(parsed.data.format, parsed.data.source);
      const result = buildNetwork(document, { generatedAt: new Date() });
      return {
        modelId: result.model.modelId,
        networkFile: result.fileText,
        builderOrder: result.summary.builderOrder,
        couplingsApplied: result.summary.couplingsApplied,
        nodeCount: result.model.nodes.length,
      };
    } catch (error) {
      if (error instanceof NetworkBuilderError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}

export { NetworkBuilderService };
