import { z } from "zod";
import {
  WorkbookMethodSchemaVersionSchema,
  WorkbookModelIdSchema,
  WorkbookRevisionSchema,
  ValidationModeSchema,
} from "../shared";
import type {
  WorkbookMethodSchemaVersion,
  WorkbookModelId,
  WorkbookRevision,
  ValidationMode,
} from "../shared";
import type {
  EventTreeCanvasLayout,
  EventTreeEndState,
  EventTreeFunctionalEvent,
  EventTreeFunctionalEventFaultTreeLink,
  EventTreeHclConfigurationReference,
  EventTreeInitiatingEventFrequency,
  EventTreeInitiatingEventReference,
  EventTreeSequence,
} from "./event-tree-model";
import {
  EventTreeCanvasLayoutSchema,
  EventTreeEndStateSchema,
  EventTreeFunctionalEventFaultTreeLinkSchema,
  EventTreeFunctionalEventSchema,
  EventTreeHclConfigurationReferenceSchema,
  EventTreeInitiatingEventFrequencySchema,
  EventTreeInitiatingEventReferenceSchema,
  EventTreeSequenceSchema,
} from "./event-tree-schemas";

type EventTreeExecutionMode = "INDEPENDENT" | "HYBRID_CAUSAL_LOGIC";

interface EventTreeCreateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

interface EventTreePatchChanges {
  code?: string;
  name?: string;
  description?: string;
  initiatingEvent?: EventTreeInitiatingEventReference | null;
  initiatingEventFrequency?: EventTreeInitiatingEventFrequency | null;
  functionalEvents?: EventTreeFunctionalEvent[];
  functionalEventFaultTreeLinks?: EventTreeFunctionalEventFaultTreeLink[];
  endStates?: EventTreeEndState[];
  sequences?: EventTreeSequence[];
  hclConfiguration?: EventTreeHclConfigurationReference | null;
  canvas?: EventTreeCanvasLayout;
}

interface EventTreePatchRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  expectedWorkbookRevision: WorkbookRevision;
  changes: EventTreePatchChanges;
}

interface EventTreeValidateRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  mode: ValidationMode;
}

interface EventTreeExecuteRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  modelId: WorkbookModelId;
  workbookRevision: WorkbookRevision;
  mode: EventTreeExecutionMode;
}

const EventTreeExecutionModeSchema = z.enum(["INDEPENDENT", "HYBRID_CAUSAL_LOGIC"]);

const EventTreeCreateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer"),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer"),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer"),
  })
  .strict();

const EventTreePatchChangesSchema = z
  .object({
    code: z.string().trim().min(1, "Model code is required").max(64, "Model code must be 64 characters or fewer").optional(),
    name: z.string().trim().min(1, "Model name is required").max(200, "Model name must be 200 characters or fewer").optional(),
    description: z.string().max(10_000, "Description must be 10,000 characters or fewer").optional(),
    initiatingEvent: EventTreeInitiatingEventReferenceSchema.nullable().optional(),
    initiatingEventFrequency: EventTreeInitiatingEventFrequencySchema.nullable().optional(),
    functionalEvents: z.array(EventTreeFunctionalEventSchema).optional(),
    functionalEventFaultTreeLinks: z.array(EventTreeFunctionalEventFaultTreeLinkSchema).optional(),
    endStates: z.array(EventTreeEndStateSchema).optional(),
    sequences: z.array(EventTreeSequenceSchema).optional(),
    hclConfiguration: EventTreeHclConfigurationReferenceSchema.nullable().optional(),
    canvas: EventTreeCanvasLayoutSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one event-tree change is required");

const EventTreePatchRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    expectedWorkbookRevision: WorkbookRevisionSchema,
    changes: EventTreePatchChangesSchema,
  })
  .strict();

const EventTreeValidateRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    mode: ValidationModeSchema,
  })
  .strict();

const EventTreeExecuteRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    mode: EventTreeExecutionModeSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEventTreeExecutionMode = Expect<
  Equal<z.infer<typeof EventTreeExecutionModeSchema>, EventTreeExecutionMode>
>;
type _AssertEventTreeCreateRequest = Expect<
  Equal<z.infer<typeof EventTreeCreateRequestSchema>, EventTreeCreateRequest>
>;
type _AssertEventTreePatchChanges = Expect<
  Equal<z.infer<typeof EventTreePatchChangesSchema>, EventTreePatchChanges>
>;
type _AssertEventTreePatchRequest = Expect<
  Equal<z.infer<typeof EventTreePatchRequestSchema>, EventTreePatchRequest>
>;
type _AssertEventTreeValidateRequest = Expect<
  Equal<z.infer<typeof EventTreeValidateRequestSchema>, EventTreeValidateRequest>
>;
type _AssertEventTreeExecuteRequest = Expect<
  Equal<z.infer<typeof EventTreeExecuteRequestSchema>, EventTreeExecuteRequest>
>;

export {
  EventTreeExecutionModeSchema,
  EventTreeCreateRequestSchema,
  EventTreePatchChangesSchema,
  EventTreePatchRequestSchema,
  EventTreeValidateRequestSchema,
  EventTreeExecuteRequestSchema,
};
export type {
  EventTreeExecutionMode,
  EventTreeCreateRequest,
  EventTreePatchChanges,
  EventTreePatchRequest,
  EventTreeValidateRequest,
  EventTreeExecuteRequest,
};
