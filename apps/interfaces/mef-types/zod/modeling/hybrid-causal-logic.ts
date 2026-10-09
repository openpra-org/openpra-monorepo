import { z } from "zod";
import { BayesianNetworkEvidenceConfigurationSchema } from "./bayesian-network";
import {
  BayesianNetworkNodeReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
} from "./references";
import {
  WorkbookEntityIdSchema,
  WorkbookModelAddressSchema,
} from "./shared";
import { AnnualizedFrequencyInputSchema } from "./quantitative-semantics";
import { UncertainExpressionSchema, UncertainVectorSchema } from "../core/uncertainty";
import type {
  HclBaseEvidence,
  HclBayesianNetworkReference,
  HclConfigurationDefinition,
  HclEventBinding,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclBasicEventUncertainty,
  HclCptRowUncertainty,
  HclCptGenerator,
  HclCptGeneratorUncertainty,
  HclUncertaintySettings,
  HclFaultTreeReference,
  HclSolverSettings,
  HclTrueStateIds,
} from "../../modeling/hybrid-causal-logic";

const HclBayesianNetworkReferenceSchema = WorkbookModelAddressSchema;

const HclFaultTreeReferenceSchema = WorkbookModelAddressSchema;

const HclEventBindingSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    faultTreeBasicEvent: FaultTreeBasicEventCatalogueReferenceSchema,
    bayesianNetworkNode: BayesianNetworkNodeReferenceSchema,
    trueStateIds: z.tuple([WorkbookEntityIdSchema]).rest(WorkbookEntityIdSchema),
  })
  .strict()
  .superRefine((binding, context) => {
    if (new Set(binding.trueStateIds).size !== binding.trueStateIds.length) {
      context.addIssue({
        code: "custom",
        path: ["trueStateIds"],
        message: "True-state ids must be unique",
      });
    }
  });

const HclBaseEvidenceSchema = BayesianNetworkEvidenceConfigurationSchema;

const HclEvidenceScenarioSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    code: z.string().trim().min(1, "Scenario code is required").max(64, "Scenario code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Scenario name is required").max(200, "Scenario name must be 200 characters or fewer"),
    enabled: z.boolean(),
    evidence: BayesianNetworkEvidenceConfigurationSchema,
  })
  .strict();

const HclHazardGridDefinitionSchema = z
  .object({
    name: z.string().trim().min(1, "Hazard-grid name is required").max(200),
    hazardNodeIds: z.tuple([WorkbookEntityIdSchema]).rest(WorkbookEntityIdSchema),
    annualFrequencyScale: AnnualizedFrequencyInputSchema,
    normalizeWeights: z.boolean(),
  })
  .strict()
  .superRefine((grid, context) => {
    if (new Set(grid.hazardNodeIds).size !== grid.hazardNodeIds.length) {
      context.addIssue({
        code: "custom",
        path: ["hazardNodeIds"],
        message: "Hazard-grid node ids must be unique",
      });
    }
  });

const HclBasicEventUncertaintySchema: z.ZodType<HclBasicEventUncertainty> = z
  .object({
    faultTreeBasicEvent: FaultTreeBasicEventCatalogueReferenceSchema,
    expression: UncertainExpressionSchema,
  })
  .strict();

const HclCptRowUncertaintySchema: z.ZodType<HclCptRowUncertainty> = z
  .object({
    bayesianNetworkNode: BayesianNetworkNodeReferenceSchema,
    cptRowId: WorkbookEntityIdSchema,
    row: UncertainVectorSchema,
  })
  .strict();

const HclCptGeneratorSchema: z.ZodType<HclCptGenerator> = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("SEISMIC_FRAGILITY"),
      pgaParentId: WorkbookEntityIdSchema,
      trueStateId: WorkbookEntityIdSchema,
      falseStateId: WorkbookEntityIdSchema,
      median: UncertainExpressionSchema,
      randomness: UncertainExpressionSchema,
      demands: z.array(z.object({ stateId: WorkbookEntityIdSchema, demand: z.number().finite().nonnegative() }).strict()).min(1),
    })
    .strict()
    .superRefine((generator, context) => {
      if (generator.trueStateId === generator.falseStateId) context.addIssue({ code: "custom", path: ["falseStateId"], message: "Failure and success states must differ" });
      if (new Set(generator.demands.map((entry) => entry.stateId)).size !== generator.demands.length) context.addIssue({ code: "custom", path: ["demands"], message: "Each PGA state has one demand" });
    }),
  z
    .object({
      kind: z.literal("SEISMIC_PGA_BINS"),
      noneStateId: WorkbookEntityIdSchema,
      missionTime: UncertainExpressionSchema,
      conversion: z.enum(["POISSON", "LINEAR"]),
      bins: z.array(z.object({ stateId: WorkbookEntityIdSchema, frequency: UncertainExpressionSchema }).strict()).min(1),
    })
    .strict()
    .superRefine((generator, context) => {
      const states = generator.bins.map((bin) => bin.stateId);
      if (new Set(states).size !== states.length || states.includes(generator.noneStateId)) context.addIssue({ code: "custom", path: ["bins"], message: "PGA bins must use unique states other than the none state" });
    }),
]);

const HclCptGeneratorUncertaintySchema: z.ZodType<HclCptGeneratorUncertainty> = z
  .object({
    bayesianNetworkNode: BayesianNetworkNodeReferenceSchema,
    generator: HclCptGeneratorSchema,
  })
  .strict();

const HclUncertaintySeedSchema = z.number().int().nonnegative();

function nodeKey(reference: { workbookId: string; modelId: string; entityId: string }): string {
  return `${reference.workbookId}:${reference.modelId}:${reference.entityId}`;
}

const HclUncertaintySettingsSchema: z.ZodType<HclUncertaintySettings> = z
  .object({
    sampleCount: z.number().int().min(10).max(10_000),
    seed: HclUncertaintySeedSchema,
    sampler: z.enum(["MC", "LHS"]),
    basicEvents: z.array(HclBasicEventUncertaintySchema),
    cptRows: z.array(HclCptRowUncertaintySchema),
    cptGenerators: z.array(HclCptGeneratorUncertaintySchema),
  })
  .strict()
  .superRefine((settings, context) => {
    const basicEvents = settings.basicEvents.map(({ faultTreeBasicEvent }) => `${faultTreeBasicEvent.workbookId}:${faultTreeBasicEvent.entityId}`);
    if (new Set(basicEvents).size !== basicEvents.length) context.addIssue({ code: "custom", path: ["basicEvents"], message: "Each basic event has one uncertainty override" });
    const rowNodes = new Set(settings.cptRows.map((row) => nodeKey(row.bayesianNetworkNode)));
    const generatorNodes = new Set<string>();
    settings.cptGenerators.forEach((generator, index) => {
      const key = nodeKey(generator.bayesianNetworkNode);
      if (rowNodes.has(key) || generatorNodes.has(key)) context.addIssue({ code: "custom", path: ["cptGenerators", index], message: "A BN node uses row laws or one generator" });
      generatorNodes.add(key);
    });
    const rows = settings.cptRows.map((row) => `${nodeKey(row.bayesianNetworkNode)}:${row.cptRowId}`);
    if (new Set(rows).size !== rows.length) context.addIssue({ code: "custom", path: ["cptRows"], message: "Each CPT row has one uncertainty law" });
  });

const HclSolverSettingsSchema = z
  .object({
    variableOrder: z.array(WorkbookEntityIdSchema).min(1, "A custom variable order cannot be empty")
      .refine((order) => new Set(order).size === order.length, "Variable-order event ids must be unique").nullable().default(null),
    foldConstants: z.boolean(),
    spliceNullGates: z.boolean(),
    uncertainty: HclUncertaintySettingsSchema.optional(),
  })
  .strict();

const HclConfigurationDefinitionBaseSchema = z
  .object({
    bayesianNetwork: HclBayesianNetworkReferenceSchema,
    faultTrees: z.array(HclFaultTreeReferenceSchema),
    bindings: z.array(HclEventBindingSchema),
    baseEvidence: HclBaseEvidenceSchema,
    evidenceScenarios: z.array(HclEvidenceScenarioSchema).optional(),
    hazardGrid: HclHazardGridDefinitionSchema.optional(),
    solverSettings: HclSolverSettingsSchema,
  })
  .strict();

type HclConfigurationDefinitionInput = z.infer<typeof HclConfigurationDefinitionBaseSchema>;

function refineHclConfigurationDefinition(
  configuration: HclConfigurationDefinitionInput,
  context: z.RefinementCtx,
): void {
  const faultTreeAddresses = configuration.faultTrees.map(
    (reference) => `${reference.workbookId}:${reference.modelId}`,
  );
  const declaredFaultTreeAddresses = new Set(faultTreeAddresses);

  if (declaredFaultTreeAddresses.size !== faultTreeAddresses.length) {
    context.addIssue({
      code: "custom",
      path: ["faultTrees"],
      message: "Fault-tree references must be unique",
    });
  }

  const bindingIds = configuration.bindings.map((binding) => binding.id);
  if (new Set(bindingIds).size !== bindingIds.length) {
    context.addIssue({
      code: "custom",
      path: ["bindings"],
      message: "HCL binding ids must be unique",
    });
  }

  const scenarios = configuration.evidenceScenarios ?? [];
  const scenarioIds = scenarios.map((scenario) => scenario.id);
  const scenarioCodes = scenarios.map((scenario) => scenario.code.trim().toUpperCase());
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    context.addIssue({
      code: "custom",
      path: ["evidenceScenarios"],
      message: "Evidence-scenario ids must be unique",
    });
  }
  if (new Set(scenarioCodes).size !== scenarioCodes.length) {
    context.addIssue({
      code: "custom",
      path: ["evidenceScenarios"],
      message: "Evidence-scenario codes must be unique",
    });
  }

  if (configuration.hazardGrid !== undefined) {
    const hazardNodeIds = new Set(configuration.hazardGrid.hazardNodeIds);
    const hazardCellKeys = new Set<string>();
    if (!scenarios.some((scenario) => scenario.enabled)) {
      context.addIssue({
        code: "custom",
        path: ["hazardGrid"],
        message: "Hazard-grid convolution requires at least one enabled evidence scenario",
      });
    }
    scenarios.forEach((scenario, scenarioIndex) => {
      if (!scenario.enabled) return;
      const observedNodeIds = new Set(scenario.evidence.observations.map((observation) => observation.nodeId));
      for (const hazardNodeId of hazardNodeIds) {
        if (!observedNodeIds.has(hazardNodeId)) {
          context.addIssue({
            code: "custom",
            path: ["evidenceScenarios", scenarioIndex, "evidence", "observations"],
            message: `Enabled hazard-grid scenario must observe hazard node '${hazardNodeId}'`,
          });
        }
      }
      const cellObservations = scenario.evidence.observations
        .filter((observation) => hazardNodeIds.has(observation.nodeId));
      const cellKey = cellObservations
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
        .map((observation) => `${observation.nodeId}:${observation.stateId}`)
        .join("|");
      if (cellObservations.length === hazardNodeIds.size && hazardCellKeys.has(cellKey)) {
        context.addIssue({
          code: "custom",
          path: ["evidenceScenarios", scenarioIndex, "evidence", "observations"],
          message: "Enabled hazard-grid scenarios must identify unique grid cells",
        });
      }
      hazardCellKeys.add(cellKey);
    });
  }

  const declaredFaultTreeWorkbookIds = new Set(
    configuration.faultTrees.map((reference) => reference.workbookId),
  );
  const boundFaultTreeEvents = new Set<string>();
  configuration.bindings.forEach((binding, index) => {
    if (!declaredFaultTreeWorkbookIds.has(binding.faultTreeBasicEvent.workbookId)) {
      context.addIssue({
        code: "custom",
        path: ["bindings", index, "faultTreeBasicEvent", "workbookId"],
        message: "Binding basic event must belong to a declared fault-tree workbook",
      });
    }

    if (
      binding.bayesianNetworkNode.workbookId !== configuration.bayesianNetwork.workbookId ||
      binding.bayesianNetworkNode.modelId !== configuration.bayesianNetwork.modelId
    ) {
      context.addIssue({
        code: "custom",
        path: ["bindings", index, "bayesianNetworkNode", "modelId"],
        message: "Binding BN node must belong to the configured Bayesian network",
      });
    }

    const faultTreeEventKey = `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`;
    if (boundFaultTreeEvents.has(faultTreeEventKey)) {
      context.addIssue({
        code: "custom",
        path: ["bindings", index, "faultTreeBasicEvent"],
        message: "A fault-tree basic event can have only one HCL binding",
      });
    }
    boundFaultTreeEvents.add(faultTreeEventKey);
  });

  const uncertainty = configuration.solverSettings.uncertainty;
  uncertainty?.basicEvents.forEach((definition, index) => {
    const reference = definition.faultTreeBasicEvent;
    if (!configuration.faultTrees.some((faultTree) => faultTree.workbookId === reference.workbookId)) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "basicEvents", index, "faultTreeBasicEvent"],
        message: "Uncertain basic event must belong to an included fault tree",
      });
    }
    if (boundFaultTreeEvents.has(`${reference.workbookId}:${reference.entityId}`)) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "basicEvents", index, "faultTreeBasicEvent"],
        message: "A BN-bound basic event takes its uncertainty from its CPT row",
      });
    }
  });
  uncertainty?.cptGenerators.forEach((definition, index) => {
    const reference = definition.bayesianNetworkNode;
    if (reference.workbookId !== configuration.bayesianNetwork.workbookId || reference.modelId !== configuration.bayesianNetwork.modelId) context.addIssue({ code: "custom", path: ["solverSettings", "uncertainty", "cptGenerators", index], message: "CPT generator must belong to the configured Bayesian network" });
  });
  uncertainty?.cptRows.forEach((definition, index) => {
    const reference = definition.bayesianNetworkNode;
    if (reference.workbookId !== configuration.bayesianNetwork.workbookId || reference.modelId !== configuration.bayesianNetwork.modelId) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "cptRows", index, "bayesianNetworkNode"],
        message: "Uncertain CPT row must belong to the configured Bayesian network",
      });
    }
  });
}

const HclConfigurationDefinitionSchema = HclConfigurationDefinitionBaseSchema.superRefine(
  refineHclConfigurationDefinition,
);

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertHclBayesianNetworkReference = Expect<
  Equal<z.infer<typeof HclBayesianNetworkReferenceSchema>, HclBayesianNetworkReference>
>;
type _AssertHclFaultTreeReference = Expect<
  Equal<z.infer<typeof HclFaultTreeReferenceSchema>, HclFaultTreeReference>
>;
type _AssertHclEventBinding = Expect<Equal<z.infer<typeof HclEventBindingSchema>, HclEventBinding>>;
type _AssertHclTrueStateIds = Expect<Equal<HclEventBinding["trueStateIds"], HclTrueStateIds>>;
type _AssertHclBaseEvidence = Expect<Equal<z.infer<typeof HclBaseEvidenceSchema>, HclBaseEvidence>>;
type _AssertHclEvidenceScenario = Expect<
  Equal<z.infer<typeof HclEvidenceScenarioSchema>, HclEvidenceScenario>
>;
type _AssertHclHazardGridDefinition = Expect<
  Equal<z.infer<typeof HclHazardGridDefinitionSchema>, HclHazardGridDefinition>
>;
type _AssertHclSolverSettings = Expect<Equal<z.infer<typeof HclSolverSettingsSchema>, HclSolverSettings>>;
type _AssertHclConfigurationDefinition = Expect<
  Equal<z.infer<typeof HclConfigurationDefinitionSchema>, HclConfigurationDefinition>
>;

export {
  HclCptGeneratorSchema,
  HclCptGeneratorUncertaintySchema,
  HclBayesianNetworkReferenceSchema,
  HclFaultTreeReferenceSchema,
  HclEventBindingSchema,
  HclBaseEvidenceSchema,
  HclEvidenceScenarioSchema,
  HclHazardGridDefinitionSchema,
  HclBasicEventUncertaintySchema,
  HclCptRowUncertaintySchema,
  HclUncertaintySeedSchema,
  HclUncertaintySettingsSchema,
  HclSolverSettingsSchema,
  HclConfigurationDefinitionBaseSchema,
  HclConfigurationDefinitionSchema,
  refineHclConfigurationDefinition,
};
