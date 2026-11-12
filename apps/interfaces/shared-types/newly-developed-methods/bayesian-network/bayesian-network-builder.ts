import { z } from "zod";

type BayesianNetworkBuilderFormat = "JSON" | "YAML";

interface BayesianNetworkBuilderRequest {
  format: BayesianNetworkBuilderFormat;
  source: string;
}

interface BayesianNetworkBuilderResponse {
  modelId: string;
  networkFile: string;
  builderOrder: string[];
  couplingsApplied: number;
  nodeCount: number;
}

const BayesianNetworkBuilderFormatSchema: z.ZodType<BayesianNetworkBuilderFormat> = z.enum(["JSON", "YAML"]);

const BayesianNetworkBuilderRequestSchema: z.ZodType<BayesianNetworkBuilderRequest> = z
  .object({
    format: BayesianNetworkBuilderFormatSchema,
    source: z.string().min(1).max(5_000_000),
  })
  .strict();

const BayesianNetworkBuilderResponseSchema: z.ZodType<BayesianNetworkBuilderResponse> = z
  .object({
    modelId: z.string().min(1),
    networkFile: z.string().min(1),
    builderOrder: z.array(z.string()),
    couplingsApplied: z.number().int().min(0),
    nodeCount: z.number().int().min(1),
  })
  .strict();

export type { BayesianNetworkBuilderFormat, BayesianNetworkBuilderRequest, BayesianNetworkBuilderResponse };
export {
  BayesianNetworkBuilderFormatSchema,
  BayesianNetworkBuilderRequestSchema,
  BayesianNetworkBuilderResponseSchema,
};
