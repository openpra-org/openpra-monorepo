import { z } from "zod";
import {
  MethodEntityIdSchema,
  MethodEntityReferenceSchema,
  MethodModelMetadataSchema,
  MethodModelReferenceSchema,
} from "../shared";
import { BayesianNetworkEvidenceConfigurationSchema } from "../bayesian-network";
import type {
  HclBaseEvidence,
  HclBayesianNetworkReference,
  HclConfigurationModel,
  HclFaultTreeReference,
  HclSolverSettings,
} from "./hcl-configuration";
import type { HclEventBinding, HclTrueStateIds } from "./hcl-bindings";

const HclBayesianNetworkReferenceSchema = z
  .object({
    bayesianNetwork: MethodModelReferenceSchema,
  })
  .strict();

const HclFaultTreeReferenceSchema = z
  .object({
    faultTree: MethodModelReferenceSchema,
  })
  .strict();

const HclEventBindingSchema = z
  .object({
    id: MethodEntityIdSchema,
    faultTreeBasicEvent: MethodEntityReferenceSchema,
    bayesianNetworkNode: MethodEntityReferenceSchema,
    trueStateIds: z.tuple([MethodEntityIdSchema]).rest(MethodEntityIdSchema),
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
    variableOrder: z.array(MethodEntityIdSchema).min(1, "A custom variable order cannot be empty").nullable(),
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

const HclConfigurationModelSchema = MethodModelMetadataSchema.extend({
  methodType: z.literal("HYBRID_CAUSAL_LOGIC"),
  ...HclBayesianNetworkReferenceSchema.shape,
  faultTrees: z.array(HclFaultTreeReferenceSchema),
  bindings: z.array(HclEventBindingSchema),
  baseEvidence: HclBaseEvidenceSchema,
  solverSettings: HclSolverSettingsSchema,
})
  .strict()
  .superRefine((configuration, context) => {
    const faultTreeModelIds = configuration.faultTrees.map((reference) => reference.faultTree.modelId);
    const declaredFaultTreeModelIds = new Set(faultTreeModelIds);

    if (declaredFaultTreeModelIds.size !== faultTreeModelIds.length) {
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

    const boundFaultTreeEvents = new Set<string>();
    configuration.bindings.forEach((binding, index) => {
      if (!declaredFaultTreeModelIds.has(binding.faultTreeBasicEvent.modelId)) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "faultTreeBasicEvent", "modelId"],
          message: "Binding fault tree must be declared by the HCL configuration",
        });
      }

      if (binding.bayesianNetworkNode.modelId !== configuration.bayesianNetwork.modelId) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "bayesianNetworkNode", "modelId"],
          message: "Binding BN node must belong to the configured Bayesian network",
        });
      }

      const faultTreeEventKey = `${binding.faultTreeBasicEvent.modelId}:${binding.faultTreeBasicEvent.entityId}`;
      if (boundFaultTreeEvents.has(faultTreeEventKey)) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "faultTreeBasicEvent"],
          message: "A fault-tree basic event can have only one HCL binding",
        });
      }
      boundFaultTreeEvents.add(faultTreeEventKey);
    });
  });

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
type _AssertHclConfigurationModel = Expect<
  Equal<z.infer<typeof HclConfigurationModelSchema>, HclConfigurationModel>
>;

export {
  HclBayesianNetworkReferenceSchema,
  HclFaultTreeReferenceSchema,
  HclEventBindingSchema,
  HclBaseEvidenceSchema,
  HclSolverSettingsSchema,
  HclConfigurationModelSchema,
};
