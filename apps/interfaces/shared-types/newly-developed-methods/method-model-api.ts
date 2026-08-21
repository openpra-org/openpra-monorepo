import { z } from "zod";
import {
  BayesianNetworkCreateRequestSchema,
  BayesianNetworkExecuteRequestSchema,
  BayesianNetworkExecuteResultSchema,
  BayesianNetworkAnalysisResultSchema,
  BayesianNetworkModelSchema,
  BayesianNetworkPatchRequestSchema,
  BayesianNetworkValidateRequestSchema,
} from "./bayesian-network";
import {
  EventTreeCreateRequestSchema,
  EventTreeExecuteRequestSchema,
  EventTreeExecuteResultSchema,
  EventTreeAnalysisResultSchema,
  EventTreeModelSchema,
  EventTreePatchRequestSchema,
  EventTreeValidateRequestSchema,
} from "./event-tree";
import {
  FaultTreeCreateRequestSchema,
  FaultTreeExecuteRequestSchema,
  FaultTreeExecuteResultSchema,
  FaultTreeAnalysisResultSchema,
  FaultTreeModelSchema,
  FaultTreePatchRequestSchema,
  FaultTreeValidateRequestSchema,
} from "./fault-tree";
import {
  HclConfigurationModelSchema,
  HclCreateRequestSchema,
  HclExecuteRequestSchema,
  HclExecuteResultSchema,
  HclQuantificationResultSchema,
  HclPatchRequestSchema,
  HclValidateRequestSchema,
} from "./hybrid-causal-logic";
import { AnalysisRunMetadataSchema } from "./shared";

const MethodModelCreateRequestSchema = z.discriminatedUnion("methodType", [
  FaultTreeCreateRequestSchema.extend({ methodType: z.literal("FAULT_TREE") }),
  BayesianNetworkCreateRequestSchema.extend({
    methodType: z.literal("BAYESIAN_NETWORK"),
  }),
  EventTreeCreateRequestSchema.extend({ methodType: z.literal("EVENT_TREE") }),
  HclCreateRequestSchema.extend({
    methodType: z.literal("HYBRID_CAUSAL_LOGIC"),
  }),
]);

const NewlyDevelopedMethodModelSchema = z.discriminatedUnion("methodType", [
  FaultTreeModelSchema,
  BayesianNetworkModelSchema,
  EventTreeModelSchema,
  HclConfigurationModelSchema,
]);

const MethodModelPatchRequestSchema = z.discriminatedUnion("methodType", [
  FaultTreePatchRequestSchema.extend({ methodType: z.literal("FAULT_TREE") }),
  BayesianNetworkPatchRequestSchema.extend({
    methodType: z.literal("BAYESIAN_NETWORK"),
  }),
  EventTreePatchRequestSchema.extend({ methodType: z.literal("EVENT_TREE") }),
  HclPatchRequestSchema.extend({
    methodType: z.literal("HYBRID_CAUSAL_LOGIC"),
  }),
]);

const MethodModelValidateRequestSchema = z.discriminatedUnion("methodType", [
  FaultTreeValidateRequestSchema.extend({ methodType: z.literal("FAULT_TREE") }),
  BayesianNetworkValidateRequestSchema.extend({
    methodType: z.literal("BAYESIAN_NETWORK"),
  }),
  EventTreeValidateRequestSchema.extend({ methodType: z.literal("EVENT_TREE") }),
  HclValidateRequestSchema.extend({
    methodType: z.literal("HYBRID_CAUSAL_LOGIC"),
  }),
]);

const MethodModelExecuteRequestSchema = z.discriminatedUnion("methodType", [
  FaultTreeExecuteRequestSchema.extend({ methodType: z.literal("FAULT_TREE") }),
  BayesianNetworkExecuteRequestSchema.extend({
    methodType: z.literal("BAYESIAN_NETWORK"),
  }),
  EventTreeExecuteRequestSchema.extend({ methodType: z.literal("EVENT_TREE") }),
  HclExecuteRequestSchema.extend({
    methodType: z.literal("HYBRID_CAUSAL_LOGIC"),
  }),
]);

const MethodModelExecuteResultSchema = z.union([
  FaultTreeExecuteResultSchema,
  BayesianNetworkExecuteResultSchema,
  EventTreeExecuteResultSchema,
  HclExecuteResultSchema,
]);

const MethodAnalysisResultSchema = z.union([
  FaultTreeAnalysisResultSchema,
  BayesianNetworkAnalysisResultSchema,
  EventTreeAnalysisResultSchema,
  HclQuantificationResultSchema,
]);

const analysisResultSchemas = {
  FAULT_TREE: FaultTreeAnalysisResultSchema,
  BAYESIAN_NETWORK: BayesianNetworkAnalysisResultSchema,
  EVENT_TREE: EventTreeAnalysisResultSchema,
  HYBRID_CAUSAL_LOGIC: HclQuantificationResultSchema,
} as const;

const MethodAnalysisRunResultSchema = z
  .object({
    run: AnalysisRunMetadataSchema,
    result: MethodAnalysisResultSchema,
  })
  .strict()
  .superRefine((response, context) => {
    if (response.run.status !== "SUCCEEDED") {
      context.addIssue({
        code: "custom",
        path: ["run", "status"],
        message: "Only a succeeded analysis run can have a result",
      });
    }

    const parsed = analysisResultSchemas[response.run.methodType].safeParse(response.result);
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "Analysis result must match the run method type",
      });
      return;
    }

    if (response.result.runId !== response.run.id) {
      context.addIssue({
        code: "custom",
        path: ["result", "runId"],
        message: "Analysis result run id must match the run metadata",
      });
    }
    if (
      response.result.modelId !== response.run.modelId ||
      response.result.modelRevision !== response.run.modelRevision
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "modelId"],
        message: "Analysis result model identity must match the run metadata",
      });
    }
    if (response.result.completedAt !== response.run.completedAt) {
      context.addIssue({
        code: "custom",
        path: ["result", "completedAt"],
        message: "Analysis result completion timestamp must match the run metadata",
      });
    }
  });

type MethodModelCreateRequest = z.infer<typeof MethodModelCreateRequestSchema>;
type NewlyDevelopedMethodModel = z.infer<typeof NewlyDevelopedMethodModelSchema>;
type MethodModelPatchRequest = z.infer<typeof MethodModelPatchRequestSchema>;
type MethodModelValidateRequest = z.infer<typeof MethodModelValidateRequestSchema>;
type MethodModelExecuteRequest = z.infer<typeof MethodModelExecuteRequestSchema>;
type MethodModelExecuteResult = z.infer<typeof MethodModelExecuteResultSchema>;
type MethodAnalysisResult = z.infer<typeof MethodAnalysisResultSchema>;
type MethodAnalysisRunResult = z.infer<typeof MethodAnalysisRunResultSchema>;

export {
  MethodModelCreateRequestSchema,
  MethodModelPatchRequestSchema,
  MethodModelValidateRequestSchema,
  MethodModelExecuteRequestSchema,
  MethodModelExecuteResultSchema,
  MethodAnalysisResultSchema,
  MethodAnalysisRunResultSchema,
  NewlyDevelopedMethodModelSchema,
};
export type {
  MethodModelCreateRequest,
  MethodModelPatchRequest,
  MethodModelValidateRequest,
  MethodModelExecuteRequest,
  MethodModelExecuteResult,
  MethodAnalysisResult,
  MethodAnalysisRunResult,
  NewlyDevelopedMethodModel,
};
