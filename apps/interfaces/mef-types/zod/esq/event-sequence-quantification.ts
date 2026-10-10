import { z } from "zod";
import type { EventSequenceQuantification } from "../../esq/event-sequence-quantification";
import {
  DependencyType,
  TruncationMethod,
  QuantificationApproach,
  CircularLogicResolutionMethod,
  RiskSignificantContributorType,
} from "../../esq/event-sequence-quantification";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import {
  FrequencySchema,
  FrequencyWithDistributionSchema,
  ParameterDistributionSchema,
  UncertainFrequencySchema,
} from "../core/events";
import { ImportanceLevelSchema, SensitivityStudySchema, BaseUncertaintyAnalysisSchema } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";
import { EsqBayesianNetworkSchema, EsqHclConfigurationSchema } from "./workbook-models";
import { EventSequenceFamilyWorkbookReferenceSchema } from "../modeling/references";
import { AleatoryVariableSchema, CCF_BFR_TOTAL_MESSAGE, CcfFactorModelSchema, LawSchema, UncertainExpressionSchema, UncertainParameterSchema, UncertainVectorParameterSchema, ccfTotalAllowedByModel } from "../core/uncertainty";
import { holdsEstimate } from "../../da/data-analysis";
import { carriesUncertainExpression } from "../../sy/systems-analysis";

export const DependencyTypeSchema = z.enum(DependencyType);
export const TruncationMethodSchema = z.enum(TruncationMethod);
export const QuantificationApproachSchema = z.enum(QuantificationApproach);
export const CircularLogicResolutionMethodSchema = z.enum(CircularLogicResolutionMethod);
export const RiskSignificantContributorTypeSchema = z.enum(RiskSignificantContributorType);

export const EventSequenceFamilyQuantificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eventSequenceFamilyRef: z.string(),
  eventSequenceFamilyReference: EventSequenceFamilyWorkbookReferenceSchema.optional(),
  crossSourceGroupingJustification: z.string().optional(),
  crossPosGroupingJustification: z.string().optional(),
  dependenciesConsideredInGrouping: z.boolean(),
  representativeSequenceSelectionBasis: z.string().optional(),
  quantificationBasis: z.enum(["POINT_ESTIMATE", "MEAN_PROPAGATED_SOKC", "MEAN_RISK_SIGNIFICANT_PARAMETERS"]),
  meanFrequency: z.union([FrequencySchema, FrequencyWithDistributionSchema]),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  percentile05: z.number().optional(),
  percentile50: z.number().optional(),
  percentile95: z.number().optional(),
  significantUncertaintySources: z.array(z.string()).optional(),
  contributionBreakdown: z
    .array(
      z.object({
        contributorRef: z.string(),
        contributorType: z.string(),
        fractionalContribution: z.number(),
      }),
    )
    .optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SequenceFrequencyEstimateSchema = z.object({
  uuid: z.string(),
  eventSequenceRef: z.string(),
  meanFrequency: z.union([FrequencySchema, FrequencyWithDistributionSchema]),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  percentile05: z.number().optional(),
  percentile50: z.number().optional(),
  percentile95: z.number().optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EsqLinkedWorkbooksSchema = z.object({
  ES: z.string().optional(),
  SY: z.string().optional(),
  DA: z.string().optional(),
  HRA: z.string().optional(),
  IE: z.string().optional(),
  POS: z.string().optional(),
  SC: z.string().optional(),
  RI: z.string().optional(),
  HS: z.string().optional(),
});

export const EsqScopeAspectSchema = z.enum(["HAZARD_GROUP", "OPERATING_STATE", "SOURCE", "INITIATOR_GROUP"]);

export const EsqScopeExclusionSchema = z.object({
  aspect: EsqScopeAspectSchema,
  item: z.string(),
  reason: z.string(),
});

export const EsqFrequencyBasisSchema = z.enum(["PER_PLANT_YEAR", "PER_REACTOR_YEAR"]);

export const EsqStateWeightingSchema = z.enum(["POS_HOURS", "TYPED_SHARES"]);

export const EsqModuleCountingSchema = z.enum(["EACH_MODULE", "ONCE_PER_PLANT"]);

export const EsqModuleCountSchema = z.object({
  value: z.number(),
  link: z
    .object({
      element: z.literal("IE"),
      workbookId: z.string(),
      field: z.literal("numberOfModules"),
    })
    .optional(),
});

export const EsqQuantificationPlanSchema = z.object({
  frequencyBasis: z.object({ value: EsqFrequencyBasisSchema, reason: z.string().optional() }).optional(),
  stateWeighting: z.object({ value: EsqStateWeightingSchema, reason: z.string().optional() }).optional(),
  modulesPerPlant: EsqModuleCountSchema.optional(),
  moduleCounting: z.object({ value: EsqModuleCountingSchema, reason: z.string().optional() }).optional(),
  reportingFloorPerYear: z.object({ value: z.number(), reason: z.string().optional() }).optional(),
  convergenceStepPercent: z.object({ value: z.number(), reason: z.string().optional() }).optional(),
});

export const EsqModelElementSchema = z.enum(["ES", "SY", "DA", "HRA", "IE", "POS", "SC"]);

export const EsqModelSourceSchema = z.object({
  element: EsqModelElementSchema,
  workbookId: z.string(),
  workbookName: z.string(),
  updatedAt: z.string().optional(),
});

export const EsqModelChangeSchema = z.object({
  table: z.enum([
    "TREE",
    "SEQUENCE",
    "FAMILY",
    "FUNCTION",
    "TOP",
    "INITIATOR",
    "STATE",
    "EVENT",
    "CCF",
    "PARAMETER",
    "HUMAN",
    "BARRIER",
    "CRITERION",
    "IMPACT",
    "QUALIFICATION",
    "ACTION",
    "RECOVERY",
    "DEPENDENCY",
  ]),
  id: z.string(),
  change: z.enum(["ADDED", "REMOVED", "CHANGED"]),
  label: z.string().optional(),
});

export const EsqBranchStateSchema = z.enum(["SUCCESS", "FAILURE", "BYPASSED"]);

export const EsqTopReferenceSchema = z.object({
  workbookId: z.string(),
  modelId: z.string(),
  gateId: z.string(),
});

export const EsqTreeRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  initiatorId: z.string(),
  stateId: z.string().optional(),
  functionIds: z.array(z.string()),
  missionTime: UncertainExpressionSchema.optional(),
  transferEntry: z.boolean(),
});

export const EsqSequenceRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  treeId: z.string(),
  path: z.record(z.string(), EsqBranchStateSchema),
  endState: z.string().optional(),
  familyId: z.string().optional(),
  releaseCategoryId: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
  transferTreeId: z.string().optional(),
  transferCarries: z.array(z.string()).optional(),
});

export const EsqFamilyRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  endState: z.string().optional(),
  releaseCategoryIds: z.array(z.string()),
});

export const EsqFunctionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  treeIds: z.array(z.string()),
  esLinks: z.array(z.object({ treeId: z.string(), top: EsqTopReferenceSchema })),
});

export const EsqTopNodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

export const EsqTopRecordSchema = z.object({
  modelId: z.string(),
  gateId: z.string(),
  code: z.string(),
  name: z.string(),
  systemId: z.string().optional(),
  systemName: z.string().optional(),
  eventIds: z.array(z.string()),
  transferModelIds: z.array(z.string()),
  gates: z.array(EsqTopNodeSchema).optional(),
  houseEvents: z.array(EsqTopNodeSchema.extend({ state: z.boolean() })).optional(),
});

export const EsqInitiatorRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  stateIds: z.array(z.string()),
  frequency: UncertainFrequencySchema.optional(),
  heldBy: z.enum(["DA", "TYPED"]).optional(),
  holderId: z.string().optional(),
});

export const EsqStateRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  hours: z.number().optional(),
});

export const EsqEventRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  systemId: z.string().optional(),
  systemName: z.string().optional(),
  failureMode: z.string().optional(),
  expression: UncertainExpressionSchema.optional(),
  value: z.number().optional(),
  valueUnit: z.enum(["PROBABILITY", "PER_HOUR"]).optional(),
  missionTime: UncertainExpressionSchema.optional(),
  heldBy: z.enum(["DA", "HRA", "TYPED"]),
  holderId: z.string().optional(),
}).superRefine((record, context) => {
  if (carriesUncertainExpression(record.failureMode)) {
    for (const field of ["value", "valueUnit", "missionTime"] as const) {
      if (record[field] !== undefined) {
        context.addIssue({ code: "custom", path: [field], message: "A component event keeps its value in the expression field" });
      }
    }
  } else if (record.expression !== undefined) {
    context.addIssue({ code: "custom", path: ["expression"], message: "Only a component event holds an uncertain expression" });
  }
});

export const EsqCcfRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemIds: z.array(z.string()),
  memberIds: z.array(z.string()),
  factors: CcfFactorModelSchema.optional(),
  total: UncertainExpressionSchema.optional(),
  estimateRef: z.string().optional(),
}).refine(ccfTotalAllowedByModel, { message: CCF_BFR_TOTAL_MESSAGE, path: ["total"] });

export const EsqParameterRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  parameterType: z.string(),
  quantificationModel: z
    .enum([
      "DEMAND_PROBABILITY",
      "RUNNING_RATE",
      "MISSION_PROBABILITY",
      "STANDBY_RATE",
      "UNAVAILABILITY",
      "HUMAN_ERROR",
      "NON_RECOVERY",
      "FREQUENCY",
      "OTHER_PROBABILITY",
    ])
    .optional(),
  estimate: UncertainExpressionSchema.optional(),
  value: z.number().optional(),
  valueType: z.enum(["POINT_ESTIMATE", "MEAN"]).optional(),
  missionTime: UncertainExpressionSchema.optional(),
  evidenceKind: z.string().optional(),
  distribution: ParameterDistributionSchema.optional(),
}).superRefine((record, context) => {
  if (holdsEstimate(record.quantificationModel)) {
    const fields = record.quantificationModel === "FREQUENCY"
      ? (["value", "valueType", "distribution"] as const)
      : (["value", "valueType", "missionTime", "distribution"] as const);
    for (const field of fields) {
      if (record[field] !== undefined) {
        context.addIssue({ code: "custom", path: [field], message: "This parameter keeps its estimate in the estimate field" });
      }
    }
  } else {
    if (record.value !== undefined && record.valueType === undefined) {
      context.addIssue({ code: "custom", path: ["valueType"], message: "This parameter needs its value type" });
    }
    if (record.estimate !== undefined) {
      context.addIssue({ code: "custom", path: ["estimate"], message: "Only a component or frequency parameter holds an uncertain estimate" });
    }
  }
});

export const EsqHumanRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  timing: z.enum(["PRE_INITIATOR", "AT_INITIATOR", "POST_INITIATOR"]).optional(),
  hep: UncertainExpressionSchema.optional(),
  assessmentType: z.enum(["CONSERVATIVE_ESTIMATE", "DETAILED_ASSESSMENT"]).optional(),
  riskSignificant: z.boolean(),
  distributionGiven: z.boolean(),
});

export const EsqBarrierRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceNames: z.array(z.string()),
  states: z.array(z.object({ stateId: z.string(), status: z.string() })),
  breachCriteria: z.array(z.string()),
  monitoring: z.array(z.string()),
});

export const EsqCriterionRecordSchema = z.object({
  id: z.string(),
  barrierRef: z.string(),
  parameters: z.array(z.object({ parameter: z.string(), criterion: z.string(), basis: z.string() })),
  loads: z.array(z.object({ sequenceId: z.string().optional(), description: z.string(), attributes: z.array(z.string()) })),
  capacityParameters: z.array(z.string()),
  method: z.enum(["CONSERVATIVE", "REALISTIC"]),
  uncertainty: z.string().optional(),
  references: z.array(z.string()),
});

export const EsqImpactRecordSchema = z.object({
  initiatorId: z.string(),
  initiatorName: z.string(),
  groupId: z.string().optional(),
  barrierRef: z.string(),
  state: z.string(),
  timing: z.string().optional(),
  mechanism: z.string().optional(),
});

export const EsqQualificationRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["ENVIRONMENT", "CAPACITY"]),
  systemId: z.string(),
  components: z.array(z.string()),
  condition: z.string(),
  groupIds: z.array(z.string()),
  eventIds: z.array(z.string()),
  beyondQualification: z.boolean(),
  treatment: z.enum(["CONSERVATIVE", "REALISTIC_JUSTIFIED"]).optional(),
  justification: z.string().optional(),
});

export const EsqActionFeasibilitySchema = z.object({
  procedure: z.boolean(),
  training: z.boolean(),
  cues: z.boolean(),
  crew: z.boolean(),
  time: z.boolean(),
  access: z.boolean(),
  equipment: z.boolean(),
});

export const EsqActionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  timing: z.enum(["AT_INITIATOR", "POST_INITIATOR"]),
  hep: UncertainExpressionSchema.optional(),
  assessmentType: z.enum(["CONSERVATIVE_ESTIMATE", "DETAILED_ASSESSMENT"]).optional(),
  riskSignificant: z.boolean(),
  cue: z.string().optional(),
  cueMinutes: z.number().optional(),
  availableMinutes: z.number().optional(),
  requiredMinutes: z.number().optional(),
  recoveryId: z.string().optional(),
  recoveryName: z.string().optional(),
  feasibility: EsqActionFeasibilitySchema.optional(),
  feasibilityNote: z.string().optional(),
});

export const EsqDependenceLevelSchema = z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]);

export const EsqRecoveryRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  hfeId: z.string(),
  restoredFunction: z.string().optional(),
  level: z.enum(["CUTSET", "SCENARIO", "SEQUENCE"]),
  sequenceIds: z.array(z.string()),
  hep: UncertainExpressionSchema.optional(),
  dependencyId: z.string().optional(),
  feasibility: EsqActionFeasibilitySchema,
  feasibilityNote: z.string().optional(),
});

export const EsqDependencyRecordSchema = z.object({
  id: z.string(),
  scope: z.enum(["PRE_INITIATOR_SET", "WITHIN_SEQUENCE"]),
  hfeIds: z.array(z.string()),
  level: EsqDependenceLevelSchema,
  jointHep: z.number(),
  stateId: z.string().optional(),
  sequenceId: z.string().optional(),
  includesRecovery: z.boolean(),
  floorNote: z.string().optional(),
});

export const EsqModelSchema = z.object({
  importedAt: z.string().optional(),
  sources: z.array(EsqModelSourceSchema),
  changes: z.array(EsqModelChangeSchema).optional(),
  trees: z.array(EsqTreeRecordSchema),
  sequences: z.array(EsqSequenceRecordSchema),
  families: z.array(EsqFamilyRecordSchema),
  functions: z.array(EsqFunctionRecordSchema),
  tops: z.array(EsqTopRecordSchema),
  initiators: z.array(EsqInitiatorRecordSchema),
  states: z.array(EsqStateRecordSchema),
  events: z.array(EsqEventRecordSchema),
  ccfGroups: z.array(EsqCcfRecordSchema),
  parameters: z.array(EsqParameterRecordSchema),
  vectors: z.array(UncertainVectorParameterSchema).optional(),
  ccfFactors: z.array(UncertainParameterSchema).optional(),
  humanEvents: z.array(EsqHumanRecordSchema),
  barriers: z.array(EsqBarrierRecordSchema).optional(),
  criteria: z.array(EsqCriterionRecordSchema).optional(),
  impacts: z.array(EsqImpactRecordSchema).optional(),
  qualifications: z.array(EsqQualificationRecordSchema).optional(),
  actions: z.array(EsqActionRecordSchema).optional(),
  recoveries: z.array(EsqRecoveryRecordSchema).optional(),
  dependencies: z.array(EsqDependencyRecordSchema).optional(),
  jointFloor: z.object({ id: z.string(), value: z.number(), justification: z.string() }).optional(),
});

export const EsqFunctionTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("FAULT_TREE"), top: EsqTopReferenceSchema }),
  z.object({
    kind: z.literal("SPLIT_FRACTION"),
    expression: UncertainExpressionSchema.optional(),
    parameterId: z.string().optional(),
    cellId: z.string().optional(),
    basis: z.string().optional(),
  }),
]);

export const EsqFunctionLinkSchema = z.object({
  functionId: z.string(),
  target: EsqFunctionTargetSchema.optional(),
  rules: z
    .array(
      z.object({
        id: z.string(),
        groupIds: z.array(z.string()),
        stateIds: z.array(z.string()),
        target: EsqFunctionTargetSchema,
        reason: z.string(),
      }),
    )
    .optional(),
  reason: z.string().optional(),
});

export const EsqInitiatorChoiceSchema = z.object({
  groupId: z.string(),
  source: z.enum(["IE", "DA", "TYPED"]),
  parameterId: z.string().optional(),
  expression: UncertainExpressionSchema.optional(),
  basis: z.string().optional(),
  shares: z.array(z.object({ stateId: z.string(), percent: z.number() })).optional(),
});

export const EsqFamilyChoiceSchema = z.object({
  familyId: z.string(),
  name: z.string().optional(),
  endState: z.string().optional(),
  releaseCategoryId: z.string().optional(),
  groupingReason: z.string().optional(),
  manual: z.object({ source: z.string() }).optional(),
});

export const EsqModelDecisionsSchema = z.object({
  functionLinks: z.array(EsqFunctionLinkSchema).optional(),
  initiatorChoices: z.array(EsqInitiatorChoiceSchema).optional(),
  familyChoices: z.array(EsqFamilyChoiceSchema).optional(),
  sequenceChoices: z.array(z.object({ sequenceId: z.string(), familyId: z.string(), reason: z.string() })).optional(),
  valueBindings: z
    .array(z.object({ eventId: z.string(), heldBy: z.enum(["DA", "HRA"]), holderId: z.string(), reason: z.string() }))
    .optional(),
});

export const EsqLogicSchema = z.object({
  flags: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        target: z.object({ kind: z.enum(["HOUSE", "EVENT", "GATE"]), id: z.string(), modelId: z.string().optional() }).optional(),
        state: z.boolean(),
        groupIds: z.array(z.string()),
        stateIds: z.array(z.string()),
        basis: z.string(),
      }),
    )
    .optional(),
  loopBreaks: z
    .array(z.object({ fromModelId: z.string(), toModelId: z.string(), state: z.boolean(), basis: z.string() }))
    .optional(),
  exclusions: z.array(z.object({ id: z.string(), eventIds: z.array(z.string()), basis: z.string() })).optional(),
});

export const EsqFragilitySchema = z.strictObject({
  median: z.number().positive(),
  betaR: z.number().nonnegative(),
  betaU: z.number().nonnegative(),
});

export const EsqCellSideSchema = z.discriminatedUnion("source", [
  z.strictObject({ source: z.literal("TYPED"), variable: AleatoryVariableSchema, basis: z.string() }),
  z.strictObject({ source: z.literal("FRAGILITY"), fragility: EsqFragilitySchema, basis: z.string() }),
  z.strictObject({ source: z.literal("DA"), parameterId: z.string().min(1), basis: z.string() }),
]);

export const EsqCellSchema = z.object({
  id: z.string(),
  barrierId: z.string(),
  modeId: z.string(),
  familyId: z.string().optional(),
  hazardGroup: z.string().optional(),
  mechanismIds: z.array(z.string()),
  variable: z.string(),
  unit: z.string(),
  basis: z.enum(["CONSERVATIVE", "REALISTIC"]),
  load: EsqCellSideSchema.optional(),
  capacity: EsqCellSideSchema.optional(),
  aging: z.string().optional(),
  use: z.enum(["SPLIT_FRACTION", "END_STATE_ATTRIBUTE"]),
  assumption: z.object({ calculation: z.string(), closure: z.string() }).optional(),
  run: z
    .object({
      runId: z.string(),
      revision: z.number(),
      at: z.string(),
      method: z.string(),
      inputs: z.string(),
      point: z.number(),
      mean: z.number().optional(),
      p05: z.number().optional(),
      p50: z.number().optional(),
      p95: z.number().optional(),
      samples: z.number().optional(),
      sampling: z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE"]).optional(),
      law: LawSchema.optional(),
    })
    .optional(),
  typed: z.object({ expression: UncertainExpressionSchema, basis: z.string() }).optional(),
  ofRecord: z.enum(["RUN", "TYPED"]).optional(),
});

export const EsqBarrierWorkSchema = z.object({
  barriers: z
    .array(
      z.object({
        barrierId: z.string(),
        manual: z.object({ name: z.string(), source: z.string(), sourceNames: z.array(z.string()) }).optional(),
        criterionId: z.string().optional(),
        impactRefs: z.array(z.string()).optional(),
        modes: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(["GROSS", "LOCALIZED"]), location: z.string() })),
      }),
    )
    .optional(),
  mechanisms: z
    .array(
      z.object({
        id: z.string(),
        barrierId: z.string(),
        modeIds: z.array(z.string()),
        kind: z.enum(["PHENOMENON", "DEGRADATION", "HAZARD"]),
        name: z.string(),
        hazardGroup: z.string().optional(),
        familyIds: z.array(z.string()),
        screening: z.object({ criterion: z.enum(["SCR-2", "SCR-3"]), basis: z.string() }).optional(),
        equipment: z.array(z.string()).optional(),
        dependency: z.string().optional(),
        basis: z.string(),
      }),
    )
    .optional(),
  phenomenaLogic: z
    .object({
      included: z.boolean(),
      basis: z.string(),
      scrubbing: z.object({ credited: z.boolean(), basis: z.string() }).optional(),
      beneficial: z.object({ credited: z.boolean(), basis: z.string() }).optional(),
    })
    .optional(),
  cells: z.array(EsqCellSchema).optional(),
  credits: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["EQUIPMENT", "ACTION"]),
        qualificationId: z.string().optional(),
        actionId: z.string().optional(),
        name: z.string(),
        familyIds: z.array(z.string()),
        environment: z.string(),
        beyondQualification: z.boolean(),
        credited: z.boolean(),
        analysis: z.string(),
        treatment: z.enum(["CONSERVATIVE", "DETAILED"]).optional(),
        feasibility: EsqActionFeasibilitySchema.optional(),
        basis: z.string(),
      }),
    )
    .optional(),
});

export const EsqSolveSweepPointSchema = z.object({
  cutOff: z.number(),
  count: z.number(),
  annualFrequency: z.number(),
});

export const EsqSolveWorkSchema = z.object({
  run: z
    .object({
      runId: z.string(),
      revision: z.number(),
      at: z.string(),
      inputs: z.string(),
      calculation: z.enum(["EXACT", "CUT_SETS"]),
      logic: z.object({
        flags: z.boolean(),
        loopBreaks: z.enum(["AS_SET", "TRUE", "FALSE"]),
        exclusions: z.boolean(),
        expandCcf: z.boolean(),
        recovery: z.boolean().optional(),
        dependency: z.boolean().optional(),
      }),
      basis: z.enum(["FREQUENCY", "PROBABILITY"]).optional(),
      quantifier: z.enum(["MCUB", "RARE_EVENT", "EXACT"]).optional(),
      cutOffs: z.array(z.number()).optional(),
      limitOrder: z.number().optional(),
      peakProbability: z.number().optional(),
      peakInitiatorFrequency: z.number().optional(),
    })
    .optional(),
  families: z.array(
    z.object({
      familyId: z.string(),
      ofRecord: z.enum(["RUN", "TYPED", "IMPORTED"]).optional(),
      run: z
        .object({
          annualFrequency: z.number(),
          sequenceCount: z.number(),
          cutSetCount: z.number().optional(),
          sweep: z.array(EsqSolveSweepPointSchema),
          states: z.array(
            z.object({ stateId: z.string(), annualFrequency: z.number(), sweep: z.array(EsqSolveSweepPointSchema) }),
          ),
        })
        .optional(),
      typed: z.object({ annualFrequency: z.number(), source: z.string() }).optional(),
      imported: z
        .object({ annualFrequency: z.number(), element: z.literal("ES"), workbookId: z.string(), at: z.string() })
        .optional(),
      reason: z.string().optional(),
    }),
  ),
  rareEventReason: z.string().optional(),
});

export const EsqPostWorkSchema = z.object({
  recoveries: z
    .array(
      z.object({
        id: z.string(),
        manual: z.object({ name: z.string() }).optional(),
        eventIds: z.array(z.string()).optional(),
        groupIds: z.array(z.string()),
        stateIds: z.array(z.string()),
        credited: z.boolean(),
        feasibility: EsqActionFeasibilitySchema.optional(),
        typed: z.object({ expression: UncertainExpressionSchema, source: z.string() }).optional(),
        ofRecord: z.enum(["HRA", "TYPED"]).optional(),
        basis: z.string(),
      }),
    )
    .optional(),
  combinations: z
    .array(
      z.object({
        id: z.string(),
        eventIds: z.array(z.string()),
        dependencyId: z.string().optional(),
        level: EsqDependenceLevelSchema.optional(),
        typed: z.object({ joint: z.number(), source: z.string() }).optional(),
        ofRecord: z.enum(["HRA", "THERP", "TYPED"]).optional(),
        floorWaiver: z.string().optional(),
        groupIds: z.array(z.string()),
        stateIds: z.array(z.string()),
        basis: z.string(),
      }),
    )
    .optional(),
  floor: z.object({ value: z.number(), source: z.string() }).optional(),
  search: z
    .object({
      runId: z.string(),
      revision: z.number(),
      at: z.string(),
      inputs: z.string(),
      raisedHep: z.number(),
      cutOff: z.number(),
      findings: z.array(
        z.object({
          eventIds: z.array(z.string()),
          treeIds: z.array(z.string()),
          cutSetCount: z.number(),
          nominalFrequency: z.number(),
        }),
      ),
    })
    .optional(),
  deletions: z
    .object({
      runId: z.string(),
      revision: z.number(),
      at: z.string(),
      inputs: z.string(),
      cutOff: z.number(),
      findings: z.array(
        z.object({
          exclusionId: z.string(),
          treeIds: z.array(z.string()),
          cutSetCount: z.number(),
          nominalFrequency: z.number(),
        }),
      ),
    })
    .optional(),
  comparison: z
    .object({
      runId: z.string(),
      at: z.string(),
      inputs: z.string(),
      families: z.array(z.object({ familyId: z.string(), annualFrequency: z.number() })),
    })
    .optional(),
});

const EsqSolveLogicShape = z.object({
  flags: z.boolean(),
  loopBreaks: z.enum(["AS_SET", "TRUE", "FALSE"]),
  exclusions: z.boolean(),
  expandCcf: z.boolean(),
  recovery: z.boolean().optional(),
  dependency: z.boolean().optional(),
});

const EsqImportanceKindSchema = z.enum(["EVENT", "PARAMETER", "HFE", "CCF_GROUP", "SYSTEM"]);

export const EsqReviewWorkSchema = z.object({
  importance: z
    .object({
      runId: z.string(),
      revision: z.number(),
      at: z.string(),
      inputs: z.string(),
      logic: EsqSolveLogicShape,
      base: z.number(),
      significant: z.array(
        z.object({
          id: z.string(),
          kind: EsqImportanceKindSchema,
          label: z.string(),
          ref: z.string().optional(),
          fussellVesely: z.number(),
          riskAchievementWorth: z.number(),
        }),
      ),
      silentEventIds: z.array(z.string()),
      thresholds: z.object({ fussellVesely: z.number(), riskAchievementWorth: z.number() }).optional(),
    })
    .optional(),
  thresholds: z.object({ fussellVesely: z.number(), riskAchievementWorth: z.number(), source: z.string() }).optional(),
  cutSetList: z.object({ runId: z.string(), at: z.string(), inputs: z.string(), cutOff: z.number() }).optional(),
  cutSetReviews: z
    .array(
      z.object({
        key: z.string(),
        familyId: z.string(),
        treeId: z.string(),
        eventIds: z.array(z.string()),
        annualFrequency: z.number(),
        significant: z.boolean(),
        verdict: z.enum(["CORRECT", "ISSUE"]).optional(),
        note: z.string(),
      }),
    )
    .optional(),
  consistency: z
    .array(z.object({ topic: z.enum(["SYSTEMS", "SUCCESS_CRITERIA", "PROCEDURES", "RULES"]), consistent: z.boolean().optional(), note: z.string() }))
    .optional(),
  comparison: z
    .object({
      possible: z.boolean(),
      reason: z.string(),
      plants: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          source: z.string(),
          familyId: z.string().optional(),
          value: z.number().optional(),
          note: z.string(),
        }),
      ),
    })
    .optional(),
  screened: z
    .array(z.object({ groupId: z.string(), familyId: z.string().optional(), frequency: z.number().optional(), conditional: z.number().optional(), basis: z.string() }))
    .optional(),
  confirmations: z.array(z.object({ eventId: z.string(), reason: z.string() })).optional(),
  reconciliations: z.array(z.object({ targetId: z.string(), note: z.string() })).optional(),
});

const EsqUncertaintyStatsShape = z.object({
  point: z.number(),
  mean: z.number(),
  standardDeviation: z.number(),
  standardError: z.number(),
  p05: z.number(),
  p50: z.number(),
  p95: z.number(),
});

const EsqUncertaintyRecordSchema = z.object({
  runId: z.string(),
  revision: z.number(),
  at: z.string(),
  inputs: z.string(),
  logic: EsqSolveLogicShape,
  trials: z.number(),
  seed: z.number(),
  method: z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE"]),
  correlation: z.enum(["SHARED", "INDEPENDENT"]),
  families: z.array(EsqUncertaintyStatsShape.extend({ familyId: z.string() })),
  total: EsqUncertaintyStatsShape.optional(),
});

export const EsqUncertaintyWorkSchema = z.object({
  run: EsqUncertaintyRecordSchema.optional(),
  independent: EsqUncertaintyRecordSchema.optional(),
});

export const EsqSensitivityWorkSchema = z.object({
  decisions: z
    .array(z.object({ id: z.string(), familyIds: z.array(z.string()), key: z.boolean().optional(), caseIds: z.array(z.string()), reason: z.string() }))
    .optional(),
  manual: z
    .array(z.object({ id: z.string(), kind: z.enum(["SOURCE", "ASSUMPTION", "ALTERNATIVE"]), text: z.string(), impact: z.string() }))
    .optional(),
  cases: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["PARAMETER", "CCF_TOTAL", "HEP", "EVENT", "GROUP_FAILED", "FLAG", "LOGIC", "HEP_95TH"]),
        target: z.string().optional(),
        value: z.number().optional(),
        factor: z.number().optional(),
        state: z.boolean().optional(),
        logic: z
          .object({
            flags: z.boolean().optional(),
            loopBreaks: z.enum(["AS_SET", "TRUE", "FALSE"]).optional(),
            exclusions: z.boolean().optional(),
            expandCcf: z.boolean().optional(),
            recovery: z.boolean().optional(),
            dependency: z.boolean().optional(),
          })
          .optional(),
        basis: z.string(),
        daCaseRef: z.object({ workbookId: z.string(), caseId: z.string() }).optional(),
        run: z
          .object({
            runId: z.string(),
            at: z.string(),
            inputs: z.string(),
            families: z.array(z.object({ familyId: z.string(), annualFrequency: z.number() })),
          })
          .optional(),
      }),
    )
    .optional(),
  preOperational: z
    .array(z.object({ id: z.string(), status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(), closure: z.string(), caseIds: z.array(z.string()) }))
    .optional(),
  manualPreOperational: z.array(z.object({ id: z.string(), text: z.string(), limitation: z.string() })).optional(),
});

export const EsqHandoffWorkSchema = z.object({
  published: z
    .object({ at: z.string(), revision: z.number(), inputs: z.string(), families: z.number(), measures: z.number() })
    .optional(),
  responses: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["FAMILY", "CONTRIBUTOR", "GENERAL"]),
        ref: z.string(),
        response: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
        sentTo: z.string().optional(),
      }),
    )
    .optional(),
});

export const ModelIntegrationSchema = z.object({
  integrationMethod: z.string(),
  softwareTools: z.array(z.string()),
  integrationSteps: z.array(z.string()),
  integrationVerification: z.string(),
  scopeCoverage: z.object({
    radionuclideSources: z.array(z.string()),
    initiatingEventGroups: z.array(z.string()),
    hazardGroups: z.array(z.string()),
    plantOperatingStates: z.array(z.string()),
    plantEvolutions: z.array(z.string()),
  }),
  scopeExclusions: z.array(EsqScopeExclusionSchema).optional(),
  systemDependenciesAccounted: z.boolean(),
  multiReactorSequencesIncluded: z.boolean(),
  multiReactorInclusionBasis: z.string().optional(),
  integrationIssues: z
    .array(
      z.object({
        description: z.string(),
        resolution: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComputerCodeRecordSchema = z.object({
  name: z.string(),
  version: z.string(),
  verificationDocumentation: z.string(),
  validationDocumentation: z.string(),
  benchmarkComparison: z.string().optional(),
  methodSpecificLimitations: z.array(z.string()),
  methodSpecificFeatures: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConvergenceAnalysisSchema = z.object({
  truncationMethod: TruncationMethodSchema,
  finalTruncationValue: z.number(),
  truncationProgression: z.array(z.number()),
  frequencyAtTruncation: z.record(z.coerce.number(), z.number()),
  percentageChangeAtTruncation: z.record(z.coerce.number(), z.number()),
  basisForSelection: z.string(),
  convergenceDemonstration: z.string(),
  dependenciesPreservedAtTruncation: z.boolean(),
  mergedCutsetTruncationConfirmed: z.boolean().optional(),
  mergedCutsetConfirmationBasis: z.string().optional(),
  truncationSensitivity: z.string().optional(),
  demonstratedFamilyRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const QuantificationMethodsSchema = z.object({
  approach: QuantificationApproachSchema,
  methodDiscriminationJustification: z.string(),
  cutsetSolutionMethod: z.enum(["MCUB", "EXACT", "RARE_EVENT"]).optional(),
  rareEventJustification: z.string().optional(),
  computerCodes: z.array(ComputerCodeRecordSchema),
  truncation: ConvergenceAnalysisSchema,
  postInitiatorHfeHandling: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RecoveryActionApplicationSchema = z.object({
  uuid: z.string(),
  recoveryActionRef: z.string(),
  appliedAtLevel: z.enum(["FAMILY", "SEQUENCE", "CUTSET"]),
  applicableFamilyRefs: z.array(z.string()).optional(),
  hrFeasibilityRequirementsSatisfied: z.boolean(),
  hrDependencyRequirementsSatisfied: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ParameterConsistencyAttestationSchema = z.object({
  capabilityCategory: z.enum(["CC_I", "CC_II"]),
  hrParameterConsistency: z.boolean(),
  daParameterConsistency: z.boolean(),
  sequenceConditionsConsidered: z.boolean(),
  harshEnvironmentsConsidered: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaParameterBasisSchema = z.object({
  uuid: z.string(),
  familyRef: z.string(),
  isRiskSignificant: z.boolean(),
  basis: z.enum(["CONSERVATIVE", "REALISTIC", "COMBINED"]),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CircularLogicResolutionSchema = z.object({
  uuid: z.string(),
  description: z.string(),
  involvedElementIds: z.array(z.string()),
  detectionMethod: z.string(),
  resolutionMethod: CircularLogicResolutionMethodSchema,
  resolutionDescription: z.string(),
  neutralityJustification: z.string(),
  resolutionImpact: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemSuccessTreatmentSchema = z.object({
  treatmentMethod: z.string(),
  systemsWithSuccessModeled: z.array(z.string()),
  impactOnResults: z.string(),
  modelingExamples: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MutuallyExclusiveEventRuleSchema = z.object({
  uuid: z.string(),
  description: z.string(),
  eventIds: z.array(z.string()),
  basis: z.string(),
  identifiedInResults: z.boolean(),
  treatment: z.enum(["LOGIC_ELIMINATION", "CUTSET_DELETION"]),
  retentionJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FlagEventSettingSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  purpose: z.string(),
  state: z.boolean(),
  effect: z.string(),
  basis: z.string(),
  isTemporary: z.boolean(),
  applicableFamilyRefs: z.array(z.string()).optional(),
  setPriorToCutsetGeneration: z.boolean(),
  houseEventNodeRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModuleUsageRecordSchema = z.object({
  uuid: z.string(),
  moduleType: z.enum(["MODULE", "SUBTREE", "SPLIT_FRACTION"]),
  processDescription: z.string(),
  sharedEventsIdentified: z.boolean(),
  trueIndependenceVerified: z.boolean(),
  perEventInterpretabilityMaintained: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MultiHfeCutsetIdentificationSchema = z.object({
  uuid: z.string(),
  quantificationResultRef: z.number().optional(),
  cutsetDescription: z.string(),
  hfeRefs: z.array(z.string()),
  potentialRiskImpact: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HfeDependencyApplicationSchema = z.object({
  uuid: z.string(),
  hrDependencyAssessmentRef: z.string(),
  cutsetContext: z.string(),
  appliedJointHep: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LinkingTransferRecordSchema = z.object({
  uuid: z.string(),
  sourceTreeDescription: z.string(),
  targetTreeDescription: z.string(),
  failedEquipmentTransferred: z.array(z.string()),
  flagSettingsTransferred: z.array(z.string()),
  otherCharacteristicsTransferred: z.array(z.string()).optional(),
  frequencyTransferred: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaDependencyAssessmentSchema = z.object({
  uuid: z.string(),
  phenomenon: z.string(),
  affectedSscRefs: z.array(z.string()),
  dependencyAssessment: z.string(),
  independenceJustifications: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const BarrierFailureModeQuantificationSchema = z.object({
  failureMode: z.string(),
  failureType: z.enum(["GROSS", "LOCALIZED_DEGRADED"]),
  mechanisms: z.array(z.string()),
  probability: z.number().optional(),
  perFamilyProbabilities: z
    .array(
      z.object({
        familyRef: z.string(),
        probability: z.number(),
      }),
    )
    .optional(),
});

export const RadionuclideBarrierQuantificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  barrierRef: z.string().optional(),
  applicableSourceRefs: z.array(z.string()),
  failureModes: z.array(BarrierFailureModeQuantificationSchema),
  challengingPhenomena: z.array(z.string()),
  hazardSpecificMechanisms: z.array(z.string()).optional(),
  designSpecificDegradationMechanisms: z.array(z.string()).optional(),
  screenedOutMechanisms: z
    .array(
      z.object({
        mechanism: z.string(),
        criterion: z.enum(["SCR-2", "SCR-3"]),
        justification: z.string(),
      }),
    )
    .optional(),
  challengeAssessment: z.object({
    basis: z.enum(["CONSERVATIVE_GENERIC_ESTIMATE", "REALISTIC_PLANT_SPECIFIC_CALCULATION"]),
    challenges: z.array(z.string()),
    genericApplicabilityJustification: z.string().optional(),
  }),
  capacityEvaluation: z.object({
    basis: z.enum(["CONSERVATIVE", "REALISTIC"]),
    description: z.string(),
    inServiceAgingIncluded: z.boolean().optional(),
  }),
  externalHazardCapacity: z
    .array(
      z.object({
        hazard: z.string(),
        basis: z.enum(["ESTIMATED", "FRAGILITY_CURVES"]),
        fragilityReference: z.string().optional(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaModelLogicSchema = z.object({
  logicIncluded: z.boolean(),
  description: z.string(),
  scrubbingEffectsIncluded: z.boolean().optional(),
  scrubbingJustification: z.string().optional(),
  beneficialFailuresIncluded: z.boolean().optional(),
  beneficialFailureJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PostReleaseHfeTreatmentSchema = z.object({
  uuid: z.string(),
  hfeRefs: z.array(z.string()),
  treatment: z.enum(["CONSERVATIVE", "DETAILED_RISK_SIGNIFICANT"]),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EquipmentSurvivabilityAssessmentSchema = z.object({
  uuid: z.string(),
  equipmentRefs: z.array(z.string()),
  environmentalConditions: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
    }),
  ),
  survivabilityCriteria: z.string(),
  assessmentResults: z.array(
    z.object({
      equipmentRef: z.string(),
      survives: z.boolean(),
      basis: z.string(),
    }),
  ),
  creditTaken: z.boolean(),
  creditJustification: z.string().optional(),
  engineeringAnalysisRefs: z.array(z.string()).optional(),
  requirementsSatisfied: z
    .object({
      syA29: z.boolean(),
      hrH2: z.boolean(),
      esqC2: z.boolean(),
      esqC4: z.boolean(),
    })
    .optional(),
  barrierFailureImpactJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DependencyTypeTreatmentSchema = z.object({
  type: DependencyTypeSchema,
  treatmentDescription: z.string(),
  modelingMethod: z.string(),
  examples: z.array(z.string()).optional(),
});

export const DependencyTreatmentSchema = z.object({
  dependenciesByType: z.array(DependencyTypeTreatmentSchema),
  postInitiatorHfeDependencyMethod: z.string(),
  postInitiatorHfeDependencyBasis: z.string(),
  ccfTreatment: z.object({
    modelingApproach: z.string(),
    parameterBasis: z.string(),
    ccfGroupRefs: z.array(z.string()),
  }),
  recoveryDependencyTreatment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CutsetLogicReviewRecordSchema = z.object({
  uuid: z.string(),
  sampleDescription: z.string(),
  quantificationResultRef: z.number().optional(),
  logicCorrect: z.boolean(),
  findings: z.string(),
  correctiveActions: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConsistencyReviewRecordSchema = z.object({
  uuid: z.string(),
  modelingConsistencyConfirmed: z.boolean(),
  modelingFindings: z.string().optional(),
  operationalConsistencyConfirmed: z.boolean(),
  operationalFindings: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RuleLogicReviewRecordSchema = z.object({
  uuid: z.string(),
  flagSettingsReviewed: z.boolean(),
  mutuallyExclusiveRulesReviewed: z.boolean(),
  recoveryRulesReviewed: z.boolean(),
  logicalResultsConfirmed: z.boolean(),
  findings: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SimilarPlantComparisonSchema = z.object({
  uuid: z.string(),
  comparisonPlants: z.array(z.string()),
  keyDifferences: z.array(z.string()),
  differenceCauses: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const NonSignificantSampleReviewSchema = z.object({
  uuid: z.string(),
  sampleDescription: z.string(),
  physicallyMeaningful: z.boolean(),
  findings: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskSignificantContributorSchema = z.object({
  uuid: z.string(),
  contributorType: RiskSignificantContributorTypeSchema,
  entityRef: z.string(),
  applicableFamilyRefs: z.array(z.string()),
  fractionalContribution: z.number().optional(),
  riskSignificanceCriteriaBasis: z.string(),
  reactorScope: z.enum(["SINGLE_REACTOR", "MULTI_REACTOR"]).optional(),
  contributionPhase: z.enum(["INITIATING_EVENT_OCCURRENCE", "MITIGATION_FAILURE"]).optional(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ImportanceMeasureEntrySchema = z.object({
  entityType: z.enum(["BASIC_EVENT", "INITIATING_EVENT", "HUMAN_FAILURE_EVENT", "CCF_GROUP", "SYSTEM", "COMPONENT"]),
  entityRef: z.string(),
  solverBasicEventId: z.number().optional(),
  systemRef: z.string().optional(),
  humanFailureEventRef: z.string().optional(),
  dataAnalysisParameterRef: z.string().optional(),
  fussellVesely: z.number().optional(),
  riskAchievementWorth: z.number().optional(),
  riskReductionWorth: z.number().optional(),
  birnbaum: z.number().optional(),
  criticality: z.number().optional(),
});

export const ImportanceAnalysisRecordSchema = z.object({
  uuid: z.string(),
  scope: z.enum(["OVERALL", "PER_FAMILY", "PER_SEQUENCE"]),
  familyRef: z.string().optional(),
  sequenceRef: z.string().optional(),
  measures: z.array(ImportanceMeasureEntrySchema),
  significanceCutoff: z.number().optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ImportanceReviewRecordSchema = z.object({
  uuid: z.string(),
  scope: z.string(),
  riCriteriaBasis: z.string(),
  consistentWithExpectations: z.boolean(),
  unexpectedResults: z
    .array(
      z.object({
        entityRef: z.string(),
        description: z.string(),
        reconciliation: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ScreenedEventCumulativeAssessmentSchema = z.object({
  screenedInitiatingEventRefs: z.array(z.string()),
  cumulativeImpactAssessment: z.string(),
  affectsRiskSignificantContributors: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModelUncertaintySourceAssessmentSchema = z.object({
  uuid: z.string(),
  sourceElementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "HS", "ESQ"]),
  uncertaintySource: z.string(),
  relatedAssumptions: z.array(z.string()),
  evaluationType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  evaluationScope: z.enum(["INDIVIDUAL", "COMBINATION"]),
  effectOnFamilyFrequencies: z.string(),
  dataAnalysisSourceRef: z.object({ workbookId: z.string(), sourceId: z.string() }).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const UncertaintyPropagationSchema = z.object({
  ...BaseUncertaintyAnalysisSchema.shape,
  characterizationLevel: z.enum(["CHARACTERIZED", "PROPAGATED_RISK_SIGNIFICANT_SOKC"]),
  parameterUncertainties: z.array(
    z
      .object({
        parameterRef: z.string(),
        estimate: UncertainExpressionSchema.optional(),
        distribution: ParameterDistributionSchema.optional(),
        basis: z.string(),
      })
      .refine((entry) => (entry.estimate === undefined) !== (entry.distribution === undefined), {
        message: "A parameter uncertainty holds an estimate or a distribution",
      }),
  ),
  stateOfKnowledgeCorrelation: z.object({
    isConsidered: z.boolean(),
    justificationIfNotConsidered: z.string().optional(),
    handlingMethod: z.enum(["SAME_RANDOM_SEED", "EXPLICIT_CORRELATION_MATRIX", "PARAMETER_GROUPING", "OTHER"]).optional(),
    handlingDescription: z.string().optional(),
    correlatedParameterGroups: z.array(z.array(z.string())).optional(),
    impactAssessment: z.string().optional(),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskIntegrationFeedbackSchema = z.object({
  analysisRef: z.string(),
  feedbackDate: z.string().optional(),
  sequenceFeedback: z
    .array(
      z.object({
        sequenceRef: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  generalFeedback: z.string().optional(),
  response: z
    .object({
      description: z.string(),
      changes: z.array(z.string()).optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
    })
    .optional(),
});

export const EsqDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  nonRecoveryTermsProcess: z.string(),
  cutsetReviewProcess: z.string(),
  quantificationProcessDescription: z.string(),
  truncationConvergenceProcess: z.string(),
  familyFrequenciesAndContributions: z.string(),
  aggregationDisaggregationInsights: z.string(),
  sequenceBinningMethod: z.string(),
  intermediateStateDependencyTreatment: z.string(),
  nonSignificanceDrivingFactors: z.string(),
  releaseCategoryResolutionInputs: z.string(),
  barrierChallengeTreatment: z.string(),
  barrierCapacityBasis: z.string(),
  uncertaintySensitivityResults: z.string(),
  importanceResults: z.string(),
  mutuallyExclusiveEventsEliminated: z.string(),
  modelingAsymmetries: z.string(),
  codeVerificationProcess: z.string(),
  undocumentedParameterEstimatesBasis: z.string(),
  pdsPreservationApproach: z.string(),
  scopeAssumptionDrivenContributors: z.string(),
  similarPlantComparison: z.string(),
  riskSignificantContributorsDocumentation: z.string(),
  uncertaintySourcesDocumentation: z.string(),
  limitationsForApplications: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceQuantificationSchema = z
  .object({
    ...technicalElementSchema(TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION).shape,
    praScope: z.string(),
    linkedWorkbooks: EsqLinkedWorkbooksSchema.optional(),
    quantificationPlan: EsqQuantificationPlanSchema.optional(),
    model: EsqModelSchema.optional(),
    modelDecisions: EsqModelDecisionsSchema.optional(),
    logic: EsqLogicSchema.optional(),
    barrierWork: EsqBarrierWorkSchema.optional(),
    solve: EsqSolveWorkSchema.optional(),
    postWork: EsqPostWorkSchema.optional(),
    review: EsqReviewWorkSchema.optional(),
    uncertaintyWork: EsqUncertaintyWorkSchema.optional(),
    sensitivityWork: EsqSensitivityWorkSchema.optional(),
    handoffWork: EsqHandoffWorkSchema.optional(),
    bayesianNetworks: z.array(EsqBayesianNetworkSchema).default([]),
    hclConfigurations: z.array(EsqHclConfigurationSchema).default([]),
    familyQuantifications: z.array(EventSequenceFamilyQuantificationSchema),
    sequenceFrequencyEstimates: z.array(SequenceFrequencyEstimateSchema).optional(),
    modelIntegration: ModelIntegrationSchema,
    quantificationMethods: QuantificationMethodsSchema,
    parameterConsistency: ParameterConsistencyAttestationSchema,
    phenomenaParameterBases: z.array(PhenomenaParameterBasisSchema).optional(),
    recoveryActionApplications: z.array(RecoveryActionApplicationSchema).optional(),
    circularLogicResolutions: z.array(CircularLogicResolutionSchema).optional(),
    systemSuccessTreatment: SystemSuccessTreatmentSchema,
    mutuallyExclusiveEventRules: z.array(MutuallyExclusiveEventRuleSchema).optional(),
    flagEventSettings: z.array(FlagEventSettingSchema).optional(),
    moduleUsageRecords: z.array(ModuleUsageRecordSchema).optional(),
    dependencyTreatment: DependencyTreatmentSchema,
    multiHfeCutsetIdentifications: z.array(MultiHfeCutsetIdentificationSchema).optional(),
    hfeDependencyApplications: z.array(HfeDependencyApplicationSchema).optional(),
    linkingTransferRecords: z.array(LinkingTransferRecordSchema).optional(),
    phenomenaDependencyAssessments: z.array(PhenomenaDependencyAssessmentSchema).optional(),
    barrierQuantifications: z.array(RadionuclideBarrierQuantificationSchema),
    phenomenaModelLogic: PhenomenaModelLogicSchema.optional(),
    postReleaseHfeTreatments: z.array(PostReleaseHfeTreatmentSchema).optional(),
    equipmentSurvivabilityAssessments: z.array(EquipmentSurvivabilityAssessmentSchema).optional(),
    cutsetLogicReviews: z.array(CutsetLogicReviewRecordSchema),
    consistencyReviews: z.array(ConsistencyReviewRecordSchema),
    ruleLogicReviews: z.array(RuleLogicReviewRecordSchema),
    similarPlantComparisons: z.array(SimilarPlantComparisonSchema).optional(),
    nonSignificantSampleReviews: z.array(NonSignificantSampleReviewSchema),
    riskSignificantContributors: z.array(RiskSignificantContributorSchema),
    importanceAnalyses: z.array(ImportanceAnalysisRecordSchema).optional(),
    importanceReviews: z.array(ImportanceReviewRecordSchema).optional(),
    screenedEventCumulativeAssessment: ScreenedEventCumulativeAssessmentSchema.optional(),
    modelUncertaintySourceAssessments: z.array(ModelUncertaintySourceAssessmentSchema).optional(),
    uncertaintyPropagation: UncertaintyPropagationSchema,
    sensitivityStudies: z.array(SensitivityStudySchema).optional(),
    quantificationRequestRefs: z.array(z.number()).optional(),
    quantificationResultRefs: z.array(z.number()).optional(),
    riskIntegrationFeedback: RiskIntegrationFeedbackSchema.optional(),
    modelUncertainty: BaseModelUncertaintyDocumentationSchema,
    preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
    documentation: EsqDocumentationSchema,
    configurationControlRecordId: z.string().optional(),
    exampleDocuments: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          kind: z.enum(["doc", "sheet", "image"]),
          sizeLabel: z.string(),
          uploadedLabel: z.string(),
          extracted: z.string(),
          linked: z.number(),
          url: z.string().optional(),
        }),
      )
      .optional(),
    newlyDevelopedMethodIds: z.array(z.string()).optional(),
  })
  .superRefine((mef, context) => {
    const seenModelIds = new Set<string>();

    for (const collection of ["bayesianNetworks", "hclConfigurations"] as const) {
      mef[collection].forEach((model, index) => {
        if (seenModelIds.has(model.modelId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [collection, index, "modelId"],
            message: "Model IDs must be unique across workbook-owned model collections",
          });
        }
        seenModelIds.add(model.modelId);
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertEsqMirrorsType = Expect<Equal<z.infer<typeof EventSequenceQuantificationSchema>, EventSequenceQuantification>>;
