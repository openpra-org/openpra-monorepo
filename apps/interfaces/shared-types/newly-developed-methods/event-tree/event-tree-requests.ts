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

type EsqRunLoopOption = "AS_SET" | "TRUE" | "FALSE";

interface EsqEventTreeRunLogic {
  flags: boolean;
  loopBreaks: EsqRunLoopOption;
  exclusions: boolean;
  expandCcf: boolean;
  recovery?: boolean;
  dependency?: boolean;
}

interface EsqEventTreeRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  treeId: string;
  workbookRevision: WorkbookRevision;
  logic: EsqEventTreeRunLogic;
}

type EventTreeCutOffBasis = "FREQUENCY" | "PROBABILITY";

type EventTreeCutSetQuantifier = "MCUB" | "RARE_EVENT" | "EXACT";

interface EventTreeCutSetFocus {
  key: string;
  events: string[];
  minimum: number;
}

interface EventTreeCutSetSettings {
  basis: EventTreeCutOffBasis;
  cutOffs: number[];
  quantifier: EventTreeCutSetQuantifier;
  limitOrder?: number;
  keep: number;
  focus?: EventTreeCutSetFocus[];
}

type EsqModelCalculation = "EXACT" | "CUT_SETS";

interface EsqModelRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  logic: EsqEventTreeRunLogic;
  calculation: EsqModelCalculation;
  cutSets?: EventTreeCutSetSettings;
}

type EsqPostRunPurpose = "COMBINATIONS" | "DELETIONS";

interface EsqPostRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  logic: EsqEventTreeRunLogic;
  purpose: EsqPostRunPurpose;
  cutOff: number;
  raisedHep?: number;
}

type EventTreeSamplingMethod = "MONTE_CARLO" | "LATIN_HYPERCUBE";

type EsqUncertaintyCorrelation = "SHARED" | "INDEPENDENT";

interface EsqImportanceRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  logic: EsqEventTreeRunLogic;
}

interface EsqUncertaintyRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  logic: EsqEventTreeRunLogic;
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
}

interface EsqSensitivityRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  workbookRevision: WorkbookRevision;
  caseId: string;
  logic: EsqEventTreeRunLogic;
  calculation: EsqModelCalculation;
  cutSets?: EventTreeCutSetSettings;
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

const EsqEventTreeRunLogicSchema = z
  .object({
    flags: z.boolean(),
    loopBreaks: z.enum(["AS_SET", "TRUE", "FALSE"]),
    exclusions: z.boolean(),
    expandCcf: z.boolean(),
    recovery: z.boolean().optional(),
    dependency: z.boolean().optional(),
  })
  .strict();

const EsqEventTreeRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    treeId: z.string().min(1),
    workbookRevision: WorkbookRevisionSchema,
    logic: EsqEventTreeRunLogicSchema,
  })
  .strict();

const EventTreeCutOffBasisSchema = z.enum(["FREQUENCY", "PROBABILITY"]);

const EventTreeCutSetQuantifierSchema = z.enum(["MCUB", "RARE_EVENT", "EXACT"]);

const EventTreeCutSetFocusSchema = z
  .object({
    key: z.string().min(1),
    events: z.array(z.string().min(1)).min(1),
    minimum: z.number().int().min(1),
  })
  .strict()
  .refine((focus) => focus.minimum <= focus.events.length && new Set(focus.events).size === focus.events.length, "A focus group needs distinct events and a minimum no larger than its events");

const EventTreeCutSetSettingsSchema = z
  .object({
    basis: EventTreeCutOffBasisSchema,
    cutOffs: z
      .array(z.number().finite().positive("A cut-off must be above zero"))
      .min(1, "Give at least one cut-off")
      .max(40, "Give at most 40 cut-offs"),
    quantifier: EventTreeCutSetQuantifierSchema,
    limitOrder: z.number().int().min(1, "The order limit must be at least 1").optional(),
    keep: z.number().int().min(1, "Keep at least one cut set").max(1000, "Keep at most 1000 cut sets"),
    focus: z.array(EventTreeCutSetFocusSchema).max(500).optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    let previous = Number.POSITIVE_INFINITY;
    for (const cutOff of settings.cutOffs) {
      if (cutOff >= previous) {
        context.addIssue({ code: "custom", path: ["cutOffs"], message: "Cut-offs run from the highest to the lowest" });
        return;
      }
      previous = cutOff;
    }
    if (settings.basis === "PROBABILITY" && settings.cutOffs.some((cutOff) => cutOff > 1)) {
      context.addIssue({ code: "custom", path: ["cutOffs"], message: "A probability cut-off cannot exceed one" });
    }
  });

const EsqModelCalculationSchema = z.enum(["EXACT", "CUT_SETS"]);

const EsqPostRunPurposeSchema = z.enum(["COMBINATIONS", "DELETIONS"]);

const EsqPostRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    logic: EsqEventTreeRunLogicSchema,
    purpose: EsqPostRunPurposeSchema,
    cutOff: z.number().finite().positive("The cutoff must be above zero"),
    raisedHep: z.number().finite().gt(0, "The raised HEP must be above zero").max(1, "The raised HEP cannot exceed one").optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.purpose === "COMBINATIONS" && request.raisedHep === undefined) {
      context.addIssue({ code: "custom", path: ["raisedHep"], message: "A combination search needs the raised HEP" });
    }
    if (request.purpose === "DELETIONS" && request.raisedHep !== undefined) {
      context.addIssue({ code: "custom", path: ["raisedHep"], message: "A deletion check keeps the nominal HEPs" });
    }
  });

const EsqModelRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    logic: EsqEventTreeRunLogicSchema,
    calculation: EsqModelCalculationSchema,
    cutSets: EventTreeCutSetSettingsSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.calculation === "CUT_SETS" && request.cutSets === undefined) {
      context.addIssue({ code: "custom", path: ["cutSets"], message: "A cut set run needs its settings" });
    }
    if (request.calculation === "EXACT" && request.cutSets !== undefined) {
      context.addIssue({ code: "custom", path: ["cutSets"], message: "An exact run takes no cut set settings" });
    }
  });

const EventTreeSamplingMethodSchema = z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE"]);

const EsqUncertaintyCorrelationSchema = z.enum(["SHARED", "INDEPENDENT"]);

const EsqImportanceRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    logic: EsqEventTreeRunLogicSchema,
  })
  .strict();

const EsqUncertaintyRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    logic: EsqEventTreeRunLogicSchema,
    trials: z.number().int().min(100, "Run at least 100 trials").max(20_000, "Run at most 20,000 trials"),
    seed: z.number().int().min(0).max(2_147_483_647),
    method: EventTreeSamplingMethodSchema,
    correlation: EsqUncertaintyCorrelationSchema,
  })
  .strict();

const EsqSensitivityRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    workbookRevision: WorkbookRevisionSchema,
    caseId: z.string().min(1),
    logic: EsqEventTreeRunLogicSchema,
    calculation: EsqModelCalculationSchema,
    cutSets: EventTreeCutSetSettingsSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.calculation === "CUT_SETS" && request.cutSets === undefined) {
      context.addIssue({ code: "custom", path: ["cutSets"], message: "A cut set run needs its settings" });
    }
    if (request.calculation === "EXACT" && request.cutSets !== undefined) {
      context.addIssue({ code: "custom", path: ["cutSets"], message: "An exact run takes no cut set settings" });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertEsqImportanceRunRequest = Expect<
  Equal<z.infer<typeof EsqImportanceRunRequestSchema>, EsqImportanceRunRequest>
>;
type _AssertEsqUncertaintyRunRequest = Expect<
  Equal<z.infer<typeof EsqUncertaintyRunRequestSchema>, EsqUncertaintyRunRequest>
>;
type _AssertEsqSensitivityRunRequest = Expect<
  Equal<z.infer<typeof EsqSensitivityRunRequestSchema>, EsqSensitivityRunRequest>
>;
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
type _AssertEsqEventTreeRunRequest = Expect<
  Equal<z.infer<typeof EsqEventTreeRunRequestSchema>, EsqEventTreeRunRequest>
>;
type _AssertEventTreeCutSetSettings = Expect<
  Equal<z.infer<typeof EventTreeCutSetSettingsSchema>, EventTreeCutSetSettings>
>;
type _AssertEsqModelRunRequest = Expect<
  Equal<z.infer<typeof EsqModelRunRequestSchema>, EsqModelRunRequest>
>;
type _AssertEsqPostRunRequest = Expect<
  Equal<z.infer<typeof EsqPostRunRequestSchema>, EsqPostRunRequest>
>;

export {
  EventTreeExecutionModeSchema,
  EventTreeCreateRequestSchema,
  EventTreePatchChangesSchema,
  EventTreePatchRequestSchema,
  EventTreeValidateRequestSchema,
  EventTreeExecuteRequestSchema,
  EsqEventTreeRunLogicSchema,
  EsqEventTreeRunRequestSchema,
  EventTreeCutOffBasisSchema,
  EventTreeCutSetQuantifierSchema,
  EventTreeCutSetSettingsSchema,
  EsqModelCalculationSchema,
  EsqModelRunRequestSchema,
  EventTreeCutSetFocusSchema,
  EsqPostRunPurposeSchema,
  EsqPostRunRequestSchema,
  EventTreeSamplingMethodSchema,
  EsqUncertaintyCorrelationSchema,
  EsqImportanceRunRequestSchema,
  EsqUncertaintyRunRequestSchema,
  EsqSensitivityRunRequestSchema,
};
export type {
  EventTreeExecutionMode,
  EventTreeCreateRequest,
  EventTreePatchChanges,
  EventTreePatchRequest,
  EventTreeValidateRequest,
  EventTreeExecuteRequest,
  EsqRunLoopOption,
  EsqEventTreeRunLogic,
  EsqEventTreeRunRequest,
  EventTreeCutOffBasis,
  EventTreeCutSetQuantifier,
  EventTreeCutSetSettings,
  EsqModelCalculation,
  EsqModelRunRequest,
  EventTreeCutSetFocus,
  EsqPostRunPurpose,
  EsqPostRunRequest,
  EventTreeSamplingMethod,
  EsqUncertaintyCorrelation,
  EsqImportanceRunRequest,
  EsqUncertaintyRunRequest,
  EsqSensitivityRunRequest,
};
