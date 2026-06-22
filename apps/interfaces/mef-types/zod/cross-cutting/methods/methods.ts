import { z } from "zod";
import type { MasterLogicDiagram } from "../../../cross-cutting/methods/master-logic-diagram";
import type { HeatBalanceFaultTree } from "../../../cross-cutting/methods/heat-balance-fault-tree";
import type { FailureModesEffectAnalysis } from "../../../cross-cutting/methods/fmea";

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

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertMld = Expect<Equal<z.infer<typeof MasterLogicDiagramSchema>, MasterLogicDiagram>>;
type _AssertHbft = Expect<Equal<z.infer<typeof HeatBalanceFaultTreeSchema>, HeatBalanceFaultTree>>;
type _AssertFmea = Expect<Equal<z.infer<typeof FailureModesEffectAnalysisSchema>, FailureModesEffectAnalysis>>;
