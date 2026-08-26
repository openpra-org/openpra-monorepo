import { z } from "zod";
import {
  createEmptyHazardConditionedMethodModels,
  type HazardConditionedMethodModels,
} from "../hazard-conditioned-models";
import {
  WorkbookBayesianNetworkSchema,
  WorkbookFaultTreeCatalogueSchema,
  WorkbookFaultTreeSchema,
} from "./modeling/workbook-models";
import { EventSequenceSchema, EventTreeSchema } from "./es/event-sequence-analysis";

const HazardConditionedMethodModelsSchema = z
  .object({
    initiatingEventFaultTrees: z.array(WorkbookFaultTreeSchema),
    faultTreeCatalogue: WorkbookFaultTreeCatalogueSchema,
    eventTrees: z.array(EventTreeSchema),
    eventSequences: z.array(EventSequenceSchema),
    dependencyBayesianNetworks: z.array(WorkbookBayesianNetworkSchema),
  })
  .strict()
  .superRefine((models, context) => {
    const assertUnique = (values: string[], path: string, label: string): void => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", path: [path], message: `${label} ids must be unique` });
      }
    };
    assertUnique(models.initiatingEventFaultTrees.map((model) => model.modelId), "initiatingEventFaultTrees", "Fault-tree model");
    assertUnique(models.eventTrees.map((model) => model.uuid), "eventTrees", "Event-tree model");
    assertUnique(models.dependencyBayesianNetworks.map((model) => model.modelId), "dependencyBayesianNetworks", "Bayesian-network model");
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertModels = Expect<
  Equal<z.infer<typeof HazardConditionedMethodModelsSchema>, HazardConditionedMethodModels>
>;

export { createEmptyHazardConditionedMethodModels, HazardConditionedMethodModelsSchema };
