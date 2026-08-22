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
import type {
  HclBaseEvidence,
  HclBayesianNetworkReference,
  HclConfigurationDefinition,
  HclEventBinding,
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

const HclSolverSettingsSchema = z
  .object({
    variableOrder: z.array(WorkbookEntityIdSchema).min(1, "A custom variable order cannot be empty").nullable(),
    foldConstants: z.boolean(),
    spliceNullGates: z.boolean(),
  })
  .strict()
  .superRefine((settings, context) => {
    if (settings.variableOrder !== null && new Set(settings.variableOrder).size !== settings.variableOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["variableOrder"],
        message: "Variable-order event ids must be unique",
      });
    }
  });

const HclConfigurationDefinitionBaseSchema = z
  .object({
    bayesianNetwork: HclBayesianNetworkReferenceSchema,
    faultTrees: z.array(HclFaultTreeReferenceSchema),
    bindings: z.array(HclEventBindingSchema),
    baseEvidence: HclBaseEvidenceSchema,
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
type _AssertHclSolverSettings = Expect<Equal<z.infer<typeof HclSolverSettingsSchema>, HclSolverSettings>>;
type _AssertHclConfigurationDefinition = Expect<
  Equal<z.infer<typeof HclConfigurationDefinitionSchema>, HclConfigurationDefinition>
>;

export {
  HclBayesianNetworkReferenceSchema,
  HclFaultTreeReferenceSchema,
  HclEventBindingSchema,
  HclBaseEvidenceSchema,
  HclSolverSettingsSchema,
  HclConfigurationDefinitionBaseSchema,
  HclConfigurationDefinitionSchema,
  refineHclConfigurationDefinition,
};
