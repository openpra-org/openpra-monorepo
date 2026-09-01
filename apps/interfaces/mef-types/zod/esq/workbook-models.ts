import { z } from "zod";
import type {
  EsqBayesianNetwork,
  EsqHclConfiguration,
  EsqHclEventBinding,
  EsqHclTrueStateIds,
  EsqWorkbookModelIdentity,
} from "../../esq/workbook-models";
import { BayesianNetworkDefinitionSchema, BayesianNetworkEvidenceConfigurationSchema } from "../modeling/bayesian-network";
import {
  BayesianNetworkNodeReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
} from "../modeling/references";
import {
  WorkbookEntityIdSchema,
  WorkbookModelAddressSchema,
  WorkbookModelIdSchema,
} from "../modeling/shared";
import {
  HclEvidenceScenarioSchema,
  HclHazardGridDefinitionSchema,
  HclSolverSettingsSchema,
} from "../modeling/hybrid-causal-logic";

const EsqWorkbookModelIdentitySchema = z
  .object({
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
  })
  .strict();

const EsqBayesianNetworkSchema = z
  .object({
    ...EsqWorkbookModelIdentitySchema.shape,
    ...BayesianNetworkDefinitionSchema.shape,
  })
  .strict();

const EsqHclTrueStateIdsSchema = z.tuple([WorkbookEntityIdSchema]).rest(WorkbookEntityIdSchema);

const EsqHclEventBindingSchema = z
  .object({
    id: WorkbookEntityIdSchema,
    faultTreeBasicEvent: FaultTreeBasicEventCatalogueReferenceSchema,
    bayesianNetworkNode: BayesianNetworkNodeReferenceSchema,
    trueStateIds: EsqHclTrueStateIdsSchema,
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

const EsqHclConfigurationBaseSchema = z
  .object({
    ...EsqWorkbookModelIdentitySchema.shape,
    bayesianNetwork: WorkbookModelAddressSchema,
    faultTrees: z.array(WorkbookModelAddressSchema),
    bindings: z.array(EsqHclEventBindingSchema),
    baseEvidence: BayesianNetworkEvidenceConfigurationSchema,
    evidenceScenarios: z.array(HclEvidenceScenarioSchema).optional(),
    hazardGrid: HclHazardGridDefinitionSchema.optional(),
    solverSettings: HclSolverSettingsSchema,
  })
  .strict();

type EsqHclConfigurationInput = z.infer<typeof EsqHclConfigurationBaseSchema>;

function refineEsqHclConfiguration(
  configuration: EsqHclConfigurationInput,
  context: z.RefinementCtx,
): void {
  const faultTreeAddresses = configuration.faultTrees.map(
    (reference) => `${reference.workbookId}:${reference.modelId}`,
  );
  if (new Set(faultTreeAddresses).size !== faultTreeAddresses.length) {
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
    const enabledScenarios = scenarios.filter((scenario) => scenario.enabled);
    if (enabledScenarios.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["hazardGrid"],
        message: "Hazard-grid convolution requires at least one enabled evidence scenario",
      });
    }
    const hazardNodeIds = new Set(configuration.hazardGrid.hazardNodeIds);
    const hazardCellKeys = new Set<string>();
    scenarios.forEach((scenario, scenarioIndex) => {
      if (!scenario.enabled) return;
      const observed = new Set(scenario.evidence.observations.map((observation) => observation.nodeId));
      for (const hazardNodeId of hazardNodeIds) {
        if (!observed.has(hazardNodeId)) {
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

  const faultTreeWorkbookIds = new Set(configuration.faultTrees.map((reference) => reference.workbookId));
  const boundFaultTreeEvents = new Set<string>();
  configuration.bindings.forEach((binding, index) => {
    if (!faultTreeWorkbookIds.has(binding.faultTreeBasicEvent.workbookId)) {
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
        path: ["bindings", index, "bayesianNetworkNode"],
        message: "Binding BN node must belong to the configured Bayesian network",
      });
    }

    const faultTreeEventAddress = `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`;
    if (boundFaultTreeEvents.has(faultTreeEventAddress)) {
      context.addIssue({
        code: "custom",
        path: ["bindings", index, "faultTreeBasicEvent"],
        message: "A fault-tree basic event can have only one HCL binding",
      });
    }
    boundFaultTreeEvents.add(faultTreeEventAddress);
  });
}

const EsqHclConfigurationSchema = EsqHclConfigurationBaseSchema.superRefine(
  refineEsqHclConfiguration,
);

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEsqWorkbookModelIdentity = Expect<
  Equal<z.infer<typeof EsqWorkbookModelIdentitySchema>, EsqWorkbookModelIdentity>
>;
type _AssertEsqBayesianNetwork = Expect<
  Equal<z.infer<typeof EsqBayesianNetworkSchema>, EsqBayesianNetwork>
>;
type _AssertEsqHclTrueStateIds = Expect<
  Equal<z.infer<typeof EsqHclTrueStateIdsSchema>, EsqHclTrueStateIds>
>;
type _AssertEsqHclEventBinding = Expect<
  Equal<z.infer<typeof EsqHclEventBindingSchema>, EsqHclEventBinding>
>;
type _AssertEsqHclConfiguration = Expect<
  Equal<z.infer<typeof EsqHclConfigurationSchema>, EsqHclConfiguration>
>;

export {
  EsqWorkbookModelIdentitySchema,
  EsqBayesianNetworkSchema,
  EsqHclTrueStateIdsSchema,
  EsqHclEventBindingSchema,
  EsqHclConfigurationBaseSchema,
  EsqHclConfigurationSchema,
  refineEsqHclConfiguration,
};
