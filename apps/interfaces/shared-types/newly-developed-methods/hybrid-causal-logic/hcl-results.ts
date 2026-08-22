import { z } from "zod";
import {
  AnalysisRunIdSchema,
  AnalysisRunMetadataSchema,
  FaultTreeTopEventReferenceSchema,
  WorkbookEntityIdSchema,
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelSnapshotIdentitySchema,
  ValidationIssueSchema,
  ValidationResultSchema,
} from "../shared";
import type {
  AnalysisRunId,
  AnalysisRunMetadata,
  FaultTreeTopEventReference,
  WorkbookEntityId,
  WorkbookMethodSchemaVersion,
  WorkbookModelSnapshotIdentity,
  ValidationIssue,
  ValidationResult,
} from "../shared";

interface HclValidationResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  validation: ValidationResult;
}

interface HclExecuteResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  run: AnalysisRunMetadata;
}

interface HclBridgeStats {
  quantifications: number;
  bddContextCacheHits: number;
  bddContextCacheMisses: number;
  bnQueryCacheHits: number;
  bnQueryCacheMisses: number;
}

interface HclJunctionTreeStats {
  numCliques: number;
  maxCliqueSize: number;
  treewidth: number;
  totalTableEntries: number;
}

interface HclQuantificationResult {
  schemaVersion: WorkbookMethodSchemaVersion;
  runId: AnalysisRunId;
  owner: WorkbookModelSnapshotIdentity;
  faultTreeTopGate: FaultTreeTopEventReference;
  probability: number;
  bddNodes: number;
  bddVariables: number;
  variableOrder: WorkbookEntityId[];
  bridge: HclBridgeStats;
  junctionTree: HclJunctionTreeStats;
  validationIssues: ValidationIssue[];
  completedAt: string;
}

const NonnegativeCounterSchema = z.number().int().nonnegative();

const HclValidationResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    validation: ValidationResultSchema,
  })
  .strict();

const HclExecuteResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    run: AnalysisRunMetadataSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.run.methodType !== "HYBRID_CAUSAL_LOGIC") {
      context.addIssue({
        code: "custom",
        path: ["run", "methodType"],
        message: "HCL execution runs must use the HYBRID_CAUSAL_LOGIC method type",
      });
    }
  });

const HclBridgeStatsSchema = z
  .object({
    quantifications: NonnegativeCounterSchema,
    bddContextCacheHits: NonnegativeCounterSchema,
    bddContextCacheMisses: NonnegativeCounterSchema,
    bnQueryCacheHits: NonnegativeCounterSchema,
    bnQueryCacheMisses: NonnegativeCounterSchema,
  })
  .strict();

const HclJunctionTreeStatsSchema = z
  .object({
    numCliques: NonnegativeCounterSchema,
    maxCliqueSize: NonnegativeCounterSchema,
    treewidth: NonnegativeCounterSchema,
    totalTableEntries: NonnegativeCounterSchema,
  })
  .strict();

const HclQuantificationResultSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    runId: AnalysisRunIdSchema,
    owner: WorkbookModelSnapshotIdentitySchema,
    faultTreeTopGate: FaultTreeTopEventReferenceSchema,
    probability: z.number().min(0, "Probability cannot be less than zero").max(1, "Probability cannot exceed one"),
    bddNodes: NonnegativeCounterSchema,
    bddVariables: NonnegativeCounterSchema,
    variableOrder: z.array(WorkbookEntityIdSchema),
    bridge: HclBridgeStatsSchema,
    junctionTree: HclJunctionTreeStatsSchema,
    validationIssues: z.array(ValidationIssueSchema),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((result, context) => {
    if (new Set(result.variableOrder).size !== result.variableOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["variableOrder"],
        message: "Result variable-order event ids must be unique",
      });
    }

    if (result.bddVariables !== result.variableOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["bddVariables"],
        message: "BDD variable count must equal the returned variable-order length",
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclValidationResult = Expect<
  Equal<z.infer<typeof HclValidationResultSchema>, HclValidationResult>
>;
type _AssertHclExecuteResult = Expect<Equal<z.infer<typeof HclExecuteResultSchema>, HclExecuteResult>>;
type _AssertHclBridgeStats = Expect<Equal<z.infer<typeof HclBridgeStatsSchema>, HclBridgeStats>>;
type _AssertHclJunctionTreeStats = Expect<
  Equal<z.infer<typeof HclJunctionTreeStatsSchema>, HclJunctionTreeStats>
>;
type _AssertHclQuantificationResult = Expect<
  Equal<z.infer<typeof HclQuantificationResultSchema>, HclQuantificationResult>
>;

export {
  HclValidationResultSchema,
  HclExecuteResultSchema,
  HclBridgeStatsSchema,
  HclJunctionTreeStatsSchema,
  HclQuantificationResultSchema,
};
export type {
  HclValidationResult,
  HclExecuteResult,
  HclBridgeStats,
  HclJunctionTreeStats,
  HclQuantificationResult,
};
