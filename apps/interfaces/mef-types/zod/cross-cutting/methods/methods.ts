import { z } from "zod";
import type { MasterLogicDiagram } from "../../../cross-cutting/methods/master-logic-diagram";
import type { HeatBalanceFaultTree } from "../../../cross-cutting/methods/heat-balance-fault-tree";
import type { FailureModesEffectAnalysis } from "../../../cross-cutting/methods/fmea";
import type { HazardOperabilityStudy } from "../../../cross-cutting/methods/hazop";
import type { ProcessHazardAnalysis } from "../../../cross-cutting/methods/process-hazard-analysis";
import type { OperatingExperienceReview } from "../../../cross-cutting/methods/operating-experience-review";
import type { GenericInitiatorCatalogue } from "../../../cross-cutting/methods/generic-initiator-catalogue";

export const MasterLogicDiagramNodeSchema = z.object({
  id: z.string(),
  description: z.string(),
  parentId: z.string().optional(),
  challengedSafetyFunctionId: z.string().optional(),
  affectedBarrierId: z.string().optional(),
  derivedInitiatorIds: z.array(z.string()),
});

export const MasterLogicDiagramSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("MASTER_LOGIC_DIAGRAM"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  radioactiveSourceIds: z.array(z.string()),
  plantOperatingStateIds: z.array(z.string()),
  radionuclideBarrierIds: z.array(z.string()),
  safetyFunctionIds: z.array(z.string()),
  systemIds: z.array(z.string()),
  nodes: z.array(MasterLogicDiagramNodeSchema),
  identifiedInitiatorIds: z.array(z.string()),
});

export const HeatBalanceInterfaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  parameters: z.array(z.string()),
  normalRanges: z.array(z.tuple([z.number(), z.number()])),
});

export const HeatBalanceImbalanceSchema = z.object({
  id: z.string(),
  description: z.string(),
  threshold: z.number(),
  consequences: z.array(z.string()),
});

export const HeatBalanceCauseSchema = z.object({
  id: z.string(),
  description: z.string(),
  probability: z.number().optional(),
});

export const HeatBalanceFaultTreeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("HEAT_BALANCE_FAULT_TREE"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  plantOperatingStateIds: z.array(z.string()),
  systemIds: z.array(z.string()),
  interfaces: z.array(HeatBalanceInterfaceSchema),
  imbalances: z.array(HeatBalanceImbalanceSchema),
  causes: z.array(HeatBalanceCauseSchema),
  identifiedInitiatorIds: z.array(z.string()),
});

export const FmeaSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  function: z.string(),
  boundaries: z.array(z.string()),
});

export const FmeaFailureModeSchema = z.object({
  id: z.string(),
  componentId: z.string(),
  mode: z.string(),
  causes: z.array(z.string()),
  localEffects: z.array(z.string()),
  systemEffects: z.array(z.string()),
  detection: z.array(z.string()),
  safeguards: z.array(z.string()),
  severity: z.number(),
  probability: z.number().optional(),
  derivedInitiatorIds: z.array(z.string()),
});

export const FailureModesEffectAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("FMEA"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  systems: z.array(FmeaSystemSchema),
  componentIds: z.array(z.string()),
  failureModes: z.array(FmeaFailureModeSchema),
});

export const HazopDeviationSchema = z.object({
  id: z.string(),
  node: z.string(),
  parameter: z.string(),
  guideword: z.enum(["NO", "MORE", "LESS", "REVERSE", "AS_WELL_AS", "PART_OF", "OTHER_THAN", "EARLY", "LATE"]),
  deviation: z.string(),
  causes: z.array(z.string()),
  consequence: z.string(),
  safeguards: z.array(z.string()),
  derivedInitiatorIds: z.array(z.string()),
});

export const HazardOperabilityStudySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("HAZARD_OPERABILITY_STUDY"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  deviations: z.array(HazopDeviationSchema),
});

export const PhaReconciliationItemSchema = z.object({
  id: z.string(),
  topic: z.string(),
  fmeaCoverage: z.string(),
  hazopCoverage: z.string(),
  resolution: z.string(),
  derivedInitiatorIds: z.array(z.string()),
});

export const ProcessHazardAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("PROCESS_HAZARD_ANALYSIS"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  scope: z.string(),
  reconciledFmeaIds: z.array(z.string()),
  reconciledHazopIds: z.array(z.string()),
  reconciliationItems: z.array(PhaReconciliationItemSchema),
  directInitiatorIds: z.array(z.string()),
});

export const OeSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  period: z.string(),
  eventsReviewed: z.number(),
  applicability: z.enum(["HIGH", "MEDIUM", "SCREENED", "OPEN"]),
  note: z.string(),
});

export const OePrecursorSchema = z.object({
  id: z.string(),
  event: z.string(),
  sourceId: z.string(),
  date: z.string(),
  derivedInitiatorIds: z.array(z.string()),
  disposition: z.enum(["RETAINED", "GROUPED", "SCREENED", "OPEN"]),
});

export const OperatingExperienceReviewSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("OPERATING_EXPERIENCE_REVIEW"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  sources: z.array(OeSourceSchema),
  precursors: z.array(OePrecursorSchema),
});

export const GenericInitiatorEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  applicable: z.boolean(),
  derivedInitiatorIds: z.array(z.string()),
  rationale: z.string(),
});

export const GenericInitiatorCatalogueSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  methodKind: z.literal("GENERIC_INITIATOR_CATALOGUE"),
  newlyDevelopedMethodId: z.string().optional(),
  analyst: z.string(),
  supportingDocuments: z.array(z.string()),
  entries: z.array(GenericInitiatorEntrySchema),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertMld = Expect<Equal<z.infer<typeof MasterLogicDiagramSchema>, MasterLogicDiagram>>;
type _AssertHbft = Expect<Equal<z.infer<typeof HeatBalanceFaultTreeSchema>, HeatBalanceFaultTree>>;
type _AssertFmea = Expect<Equal<z.infer<typeof FailureModesEffectAnalysisSchema>, FailureModesEffectAnalysis>>;
type _AssertHazop = Expect<Equal<z.infer<typeof HazardOperabilityStudySchema>, HazardOperabilityStudy>>;
type _AssertPha = Expect<Equal<z.infer<typeof ProcessHazardAnalysisSchema>, ProcessHazardAnalysis>>;
type _AssertOerev = Expect<Equal<z.infer<typeof OperatingExperienceReviewSchema>, OperatingExperienceReview>>;
type _AssertGenlist = Expect<Equal<z.infer<typeof GenericInitiatorCatalogueSchema>, GenericInitiatorCatalogue>>;
