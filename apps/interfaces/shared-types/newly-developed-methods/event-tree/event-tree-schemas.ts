import { z } from "zod";
import { EventTreeDefinitionSchema } from "interfaces-mef-types/zod/modeling";
import { WorkbookModelIdSchema } from "../shared";
import type { EventTreeModel } from "./event-tree-model";

const EventTreeModelSchema = z.object({
  modelId: WorkbookModelIdSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  ...EventTreeDefinitionSchema.shape,
}).strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEventTreeModel = Expect<Equal<z.infer<typeof EventTreeModelSchema>, EventTreeModel>>;

export {
  EventTreeEntityIdentitySchema,
  EventTreeInitiatingEventReferenceSchema,
  EventTreeControlledDataSourceReferenceSchema,
  EventTreeInitiatingEventFrequencySchema,
  EventTreeFunctionalEventSchema,
  EventTreeFunctionalEventFaultTreeLinkSchema,
  EventTreeBranchOutcomeSchema,
  EventTreeSequencePathStepSchema,
  EventTreeEndStateSchema,
  EventTreeEndStateBranchResultSchema,
  EventTreeTransferBranchResultSchema,
  EventTreeBranchResultSchema,
  EventTreeSequenceSchema,
  EventTreeNodePositionSchema,
  EventTreeHclConfigurationReferenceSchema,
  EventTreeCanvasLayoutSchema,
  EventTreeDefinitionSchema,
} from "interfaces-mef-types/zod/modeling";
export { EventTreeModelSchema };
