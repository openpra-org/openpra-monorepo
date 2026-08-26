import { z } from "zod";
import type {
  WorkbookBayesianNetwork,
  WorkbookFaultTree,
  WorkbookFaultTreeCatalogue,
  WorkbookMethodModelIdentity,
} from "../../modeling/workbook-models";
import { BayesianNetworkDefinitionSchema } from "./bayesian-network";
import {
  FaultTreeBasicEventCatalogueDefinitionSchema,
  FaultTreeDefinitionSchema,
} from "./fault-tree";
import { WorkbookModelIdSchema } from "./shared";

const WorkbookMethodModelIdentitySchema = z
  .object({
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(200),
    description: z.string().max(10_000),
  })
  .strict();

const WorkbookFaultTreeSchema = z
  .object({
    ...WorkbookMethodModelIdentitySchema.shape,
    ...FaultTreeDefinitionSchema.shape,
  })
  .strict();

const WorkbookBayesianNetworkSchema = z
  .object({
    ...WorkbookMethodModelIdentitySchema.shape,
    ...BayesianNetworkDefinitionSchema.shape,
  })
  .strict();

const WorkbookFaultTreeCatalogueSchema = FaultTreeBasicEventCatalogueDefinitionSchema;

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertIdentity = Expect<
  Equal<z.infer<typeof WorkbookMethodModelIdentitySchema>, WorkbookMethodModelIdentity>
>;
type _AssertFaultTree = Expect<
  Equal<z.infer<typeof WorkbookFaultTreeSchema>, WorkbookFaultTree>
>;
type _AssertBayesianNetwork = Expect<
  Equal<z.infer<typeof WorkbookBayesianNetworkSchema>, WorkbookBayesianNetwork>
>;
type _AssertCatalogue = Expect<
  Equal<z.infer<typeof WorkbookFaultTreeCatalogueSchema>, WorkbookFaultTreeCatalogue>
>;

export {
  WorkbookBayesianNetworkSchema,
  WorkbookFaultTreeCatalogueSchema,
  WorkbookFaultTreeSchema,
  WorkbookMethodModelIdentitySchema,
};
