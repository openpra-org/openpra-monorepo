import { z } from "zod";
import {
  FaultTreeBasicEventCatalogueDefinitionSchema,
  FaultTreeDefinitionSchema,
} from "interfaces-mef-types/zod/modeling";
import { WorkbookAddressSchema, WorkbookModelIdSchema } from "../shared";
import type { FaultTreeBasicEventCatalogue, FaultTreeModel } from "./fault-tree-model";

const FaultTreeBasicEventCatalogueSchema = z
  .object({
    ...WorkbookAddressSchema.shape,
    ...FaultTreeBasicEventCatalogueDefinitionSchema.shape,
  })
  .strict();

const FaultTreeModelSchema = z.object({
  modelId: WorkbookModelIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  ...FaultTreeDefinitionSchema.shape,
}).strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertFaultTreeBasicEventCatalogue = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventCatalogueSchema>, FaultTreeBasicEventCatalogue>
>;
type _AssertFaultTreeModel = Expect<Equal<z.infer<typeof FaultTreeModelSchema>, FaultTreeModel>>;

export {
  FaultTreeEntityIdentitySchema,
  FaultTreeAndGateSchema,
  FaultTreeOrGateSchema,
  FaultTreeNotGateSchema,
  FaultTreeKOfNGateSchema,
  FaultTreeGateSchema,
  FaultTreeTopGateReferenceSchema,
  FaultTreeBasicEventReferenceSchema,
  FaultTreeHouseEventSchema,
  FaultTreeUndevelopedEventSchema,
  FaultTreeTransferReferenceSchema,
  FaultTreeLeafNodeSchema,
  FaultTreeGateInputSchema,
  FaultTreeNodePositionSchema,
  FaultTreeControlledDataSourceReferenceSchema,
  FaultTreeBasicEventProbabilitySchema,
  FaultTreeBasicEventSchema,
  FaultTreeBasicEventCatalogueDefinitionSchema,
  FaultTreeDefinitionSchema,
} from "interfaces-mef-types/zod/modeling";
export { FaultTreeBasicEventCatalogueSchema, FaultTreeModelSchema };
