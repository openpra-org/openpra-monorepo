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
import type {
  HclBaseEvidence,
  HclBayesianNetworkReference,
  HclConfigurationDefinition,
  HclEventBinding,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclBasicEventProbabilityDistribution,
  HclBasicEventUncertainty,
  HclCptRowUncertainty,
  HclCptPrior,
  HclCptGenerator,
  HclCptGeneratorUncertainty,
  HclUncertaintySettings,
  HclSampler,
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

const HclBasicEventProbabilityDistributionSchema: z.ZodType<HclBasicEventProbabilityDistribution> = z.discriminatedUnion("family", [
  z.object({ family: z.literal("BETA"), alpha: z.number().finite().positive(), beta: z.number().finite().positive() }).strict(),
  z.object({ family: z.literal("LOGNORMAL"), median: z.number().finite().positive(), errorFactor: z.number().finite().min(1) }).strict(),
  z.object({ family: z.literal("UNIFORM"), lower: z.number().finite(), upper: z.number().finite() }).strict(),
  z.object({ family: z.literal("NORMAL"), mean: z.number().finite(), standardDeviation: z.number().finite().nonnegative() }).strict(),
  z.object({ family: z.literal("LOGITNORMAL"), mu: z.number().finite(), sigma: z.number().finite().nonnegative() }).strict(),
  z.object({ family: z.literal("GAMMA"), shape: z.number().finite().positive(), scale: z.number().finite().positive() }).strict(),
  z.object({ family: z.literal("EXPONENTIAL"), rate: z.number().finite().positive() }).strict(),
  z.object({ family: z.literal("TRIANGULAR"), lower: z.number().finite(), mode: z.number().finite(), upper: z.number().finite() }).strict().refine((value) => value.lower < value.upper && value.lower <= value.mode && value.mode <= value.upper, { message: "Triangular bounds must satisfy lower <= mode <= upper and lower < upper", path: ["mode"] }),
]);

/** Match HCL_MH sample_dist: NumPy MC and SciPy LHS have different domains. */
function hclProbabilityDistributionSchemaForSampler(sampler: HclSampler) {
  return HclBasicEventProbabilityDistributionSchema.superRefine((distribution, context) => {
    if (sampler === "MC") {
      if (distribution.family === "UNIFORM" && (distribution.lower > distribution.upper || !Number.isFinite(distribution.upper - distribution.lower))) {
        context.addIssue({ code: "custom", path: ["upper"], message: "MC uniform requires lower <= upper and a finite width" });
      }
      return;
    }
    const parameter = distribution.family === "NORMAL" && distribution.standardDeviation === 0 ? "standardDeviation"
      : distribution.family === "LOGITNORMAL" && distribution.sigma === 0 ? "sigma"
      : distribution.family === "LOGNORMAL" && distribution.errorFactor === 1 ? "errorFactor" : undefined;
    if (parameter) context.addIssue({ code: "custom", path: [parameter], message: "HCL_MH LHS returns undefined samples for zero spread; use MC or a positive spread" });
  });
}

const HclBasicEventUncertaintySchema: z.ZodType<HclBasicEventUncertainty> = z
  .object({
    faultTreeBasicEvent: FaultTreeBasicEventCatalogueReferenceSchema,
    distribution: HclBasicEventProbabilityDistributionSchema,
  })
  .strict();

const HclCptPriorSchema: z.ZodType<HclCptPrior> = z.discriminatedUnion("family", [
  z.object({ family: z.literal("BETA"), alpha: z.number().finite().positive(), beta: z.number().finite().positive(), trueStateId: WorkbookEntityIdSchema }).strict(),
  z.object({ family: z.literal("DIRICHLET"), alpha: z.array(z.number().finite().nonnegative()).min(1) }).strict()
    .refine(({ alpha }) => alpha.some((a) => a > 0) && Number.isFinite(alpha.reduce((sum, a) => sum + a, 0)), { message: "Dirichlet alpha must have a positive finite total", path: ["alpha"] }),
]);

const HclCptRowUncertaintySchema: z.ZodType<HclCptRowUncertainty> = z
  .object({
    bayesianNetworkNode: BayesianNetworkNodeReferenceSchema,
    cptRowId: WorkbookEntityIdSchema,
    prior: HclCptPriorSchema,
  })
  .strict();

const HclCptGeneratorSchema: z.ZodType<HclCptGenerator> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("seismic_fragility"), pgaParentId: WorkbookEntityIdSchema,
    theta: z.number().finite().positive(), betaR: z.number().finite().positive(), betaU: z.number().finite().nonnegative(),
    trueStateId: WorkbookEntityIdSchema, falseStateId: WorkbookEntityIdSchema,
    pgaCenters: z.array(z.object({ stateId: WorkbookEntityIdSchema, value: z.number().finite().nonnegative() }).strict()).min(1),
  }).strict().superRefine((g, ctx) => {
    if (g.trueStateId === g.falseStateId) ctx.addIssue({ code: "custom", path: ["falseStateId"], message: "Failure and success states must differ" });
    if (new Set(g.pgaCenters.map((c) => c.stateId)).size !== g.pgaCenters.length) ctx.addIssue({ code: "custom", path: ["pgaCenters"], message: "PGA center states must be unique" });
  }),
  z.object({
    type: z.literal("seismic_pga_bins"), noneStateId: WorkbookEntityIdSchema,
    missionTime: z.number().finite().positive(), frequencyToProbability: z.enum(["poisson", "linear"]),
    bins: z.array(z.object({ stateId: WorkbookEntityIdSchema, medianFrequency: z.number().finite().nonnegative(), errorFactor95: z.number().finite().gt(1) }).strict()).min(1),
  }).strict().superRefine((g, ctx) => {
    if (new Set(g.bins.map((b) => b.stateId)).size !== g.bins.length || g.bins.some((b) => b.stateId === g.noneStateId)) ctx.addIssue({ code: "custom", path: ["bins"], message: "PGA bins must use unique states excluding the none state" });
  }),
]);
const HclCptGeneratorUncertaintySchema: z.ZodType<HclCptGeneratorUncertainty> = z.object({
  bayesianNetworkNode: BayesianNetworkNodeReferenceSchema, generator: HclCptGeneratorSchema,
}).strict();

// The numeric web contract accepts every nonnegative JavaScript-safe integer.
// Keep seeds exact in JSON; the solver's NumPy-compatible RNG is unchanged.
const HclUncertaintySeedSchema = z.number().int().nonnegative();

const HclUncertaintySettingsSchema: z.ZodType<HclUncertaintySettings> = z
  .object({
    sampleCount: z.number().int().min(10).max(10_000),
    seed: HclUncertaintySeedSchema,
    sampler: z.enum(["MC", "LHS"]).optional(),
    basicEventSampler: z.enum(["MC", "LHS"]).optional(),
    cptProbabilityClipEpsilon: z.number().finite().min(0).lt(0.5).optional(),
    basicEventDistributions: z.array(HclBasicEventUncertaintySchema),
    cptRowDistributions: z.array(HclCptRowUncertaintySchema),
    cptGenerators: z.array(HclCptGeneratorUncertaintySchema).optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    if (settings.sampler && settings.basicEventSampler && settings.sampler !== settings.basicEventSampler) context.addIssue({ code: "custom", path: ["sampler"], message: "Conflicting sampler settings" });
    const distributionSchema = hclProbabilityDistributionSchemaForSampler(settings.sampler ?? settings.basicEventSampler ?? "MC");
    settings.basicEventDistributions.forEach(({ distribution }, index) => {
      const parsed = distributionSchema.safeParse(distribution);
      if (!parsed.success) parsed.error.issues.forEach((issue) => context.addIssue({ ...issue, path: ["basicEventDistributions", index, "distribution", ...issue.path] }));
    });
    const basicEvents = settings.basicEventDistributions.map(({ faultTreeBasicEvent }) => `${faultTreeBasicEvent.workbookId}:${faultTreeBasicEvent.entityId}`);
    if (new Set(basicEvents).size !== basicEvents.length) context.addIssue({ code: "custom", path: ["basicEventDistributions"], message: "Basic-event uncertainty definitions must be unique" });
    const rowNodes = new Set(settings.cptRowDistributions.map((r) => `${r.bayesianNetworkNode.workbookId}:${r.bayesianNetworkNode.modelId}:${r.bayesianNetworkNode.entityId}`));
    const generatorNodes = new Set<string>();
    settings.cptGenerators?.forEach((g, index) => {
      const key = `${g.bayesianNetworkNode.workbookId}:${g.bayesianNetworkNode.modelId}:${g.bayesianNetworkNode.entityId}`;
      if (rowNodes.has(key) || generatorNodes.has(key)) context.addIssue({ code: "custom", path: ["cptGenerators", index], message: "A BN node must use row priors or one generator" });
      generatorNodes.add(key);
    });
    const cptRows = settings.cptRowDistributions.map(({ bayesianNetworkNode, cptRowId }) => `${bayesianNetworkNode.workbookId}:${bayesianNetworkNode.modelId}:${bayesianNetworkNode.entityId}:${cptRowId}`);
    if (new Set(cptRows).size !== cptRows.length) context.addIssue({ code: "custom", path: ["cptRowDistributions"], message: "CPT-row uncertainty definitions must be unique" });
  })
  .transform(({ basicEventSampler, ...settings }) => basicEventSampler === undefined ? settings : { ...settings, sampler: settings.sampler ?? basicEventSampler });

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
  uncertainty?.basicEventDistributions.forEach((definition, index) => {
    const reference = definition.faultTreeBasicEvent;
    if (!configuration.faultTrees.some((faultTree) => faultTree.workbookId === reference.workbookId)) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "basicEventDistributions", index, "faultTreeBasicEvent"],
        message: "Uncertain basic event must belong to an included fault tree",
      });
    }
    if (boundFaultTreeEvents.has(`${reference.workbookId}:${reference.entityId}`)) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "basicEventDistributions", index, "faultTreeBasicEvent"],
        message: "BN-bound basic-event uncertainty must be defined on the corresponding BN CPT row",
      });
    }
  });
  uncertainty?.cptGenerators?.forEach((definition, index) => {
    const reference = definition.bayesianNetworkNode;
    if (reference.workbookId !== configuration.bayesianNetwork.workbookId || reference.modelId !== configuration.bayesianNetwork.modelId) context.addIssue({ code: "custom", path: ["solverSettings", "uncertainty", "cptGenerators", index], message: "CPT generator must belong to the configured Bayesian network" });
  });
  uncertainty?.cptRowDistributions.forEach((definition, index) => {
    const reference = definition.bayesianNetworkNode;
    if (reference.workbookId !== configuration.bayesianNetwork.workbookId || reference.modelId !== configuration.bayesianNetwork.modelId) {
      context.addIssue({
        code: "custom",
        path: ["solverSettings", "uncertainty", "cptRowDistributions", index, "bayesianNetworkNode"],
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
  HclCptPriorSchema,
  HclBayesianNetworkReferenceSchema,
  HclFaultTreeReferenceSchema,
  HclEventBindingSchema,
  HclBaseEvidenceSchema,
  HclEvidenceScenarioSchema,
  HclHazardGridDefinitionSchema,
  HclBasicEventProbabilityDistributionSchema,
  hclProbabilityDistributionSchemaForSampler,
  HclBasicEventUncertaintySchema,
  HclCptRowUncertaintySchema,
  HclUncertaintySeedSchema,
  HclUncertaintySettingsSchema,
  HclSolverSettingsSchema,
  HclConfigurationDefinitionBaseSchema,
  HclConfigurationDefinitionSchema,
  refineHclConfigurationDefinition,
};
