import { z } from "zod";
import {
  MethodEntityIdSchema,
  WorkbookModelSnapshotIdentitySchema,
} from "./method-model";

const CURRENT_VALIDATION_RESULT_SCHEMA_VERSION = "1.0.0" as const;
const ValidationResultSchemaVersionSchema = z.literal(CURRENT_VALIDATION_RESULT_SCHEMA_VERSION);
const ValidationModeSchema = z.enum(["DRAFT", "ANALYSIS_READY"]);
const ValidationSeveritySchema = z.enum(["ERROR", "WARNING", "INFO"]);
const ValidationFieldPathSegmentSchema = z.union([
  z.string().min(1, "Field path keys cannot be empty"),
  z.number().int().nonnegative(),
]);
const ValidationFieldPathSchema = z.array(ValidationFieldPathSegmentSchema);

const ValidationIssueSchema = z
  .object({
    code: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/, "Validation issue codes must use upper snake case"),
    severity: ValidationSeveritySchema,
    message: z.string().trim().min(1, "Validation issue message is required"),
    entityId: MethodEntityIdSchema,
    fieldPath: ValidationFieldPathSchema,
  })
  .strict();

const ValidationResultFields = {
  schemaVersion: ValidationResultSchemaVersionSchema,
  owner: WorkbookModelSnapshotIdentitySchema,
  mode: ValidationModeSchema,
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  validatedAt: z.string().datetime({ offset: true }),
};

const refineValidationResult: Parameters<z.ZodObject<typeof ValidationResultFields>["superRefine"]>[0] = (
  result,
  context,
) => {
  const hasErrors = result.issues.some((issue) => issue.severity === "ERROR");
  if (result.valid === hasErrors) {
    context.addIssue({
      code: "custom",
      path: ["valid"],
      message: "Validation result is valid only when it contains no error issues",
    });
  }
};

const ValidationResultSchema = z.object(ValidationResultFields).strict().superRefine(refineValidationResult);

const DraftValidationResultSchema = z
  .object({
    ...ValidationResultFields,
    mode: z.literal("DRAFT"),
  })
  .strict()
  .superRefine(refineValidationResult);

const DraftValidationOutcomeSchema = z
  .object({
    validation: DraftValidationResultSchema,
    saveAllowed: z.literal(true),
  })
  .strict();

const AnalysisReadyValidationResultSchema = z
  .object({
    ...ValidationResultFields,
    mode: z.literal("ANALYSIS_READY"),
  })
  .strict()
  .superRefine(refineValidationResult);

const AnalysisReadyValidationOutcomeSchema = z
  .object({
    validation: AnalysisReadyValidationResultSchema,
    quantificationAllowed: z.boolean(),
  })
  .strict()
  .superRefine((outcome, context) => {
    if (outcome.quantificationAllowed !== outcome.validation.valid) {
      context.addIssue({
        code: "custom",
        path: ["quantificationAllowed"],
        message: "Quantification is allowed only when analysis-ready validation succeeds",
      });
    }
  });

type ValidationResultSchemaVersion = z.infer<typeof ValidationResultSchemaVersionSchema>;
type ValidationMode = z.infer<typeof ValidationModeSchema>;
type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;
type ValidationFieldPathSegment = z.infer<typeof ValidationFieldPathSegmentSchema>;
type ValidationFieldPath = z.infer<typeof ValidationFieldPathSchema>;
type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
type ValidationResult = z.infer<typeof ValidationResultSchema>;
type DraftValidationResult = z.infer<typeof DraftValidationResultSchema>;
type DraftValidationOutcome = z.infer<typeof DraftValidationOutcomeSchema>;
type CreateDraftValidationOutcomeInput = Pick<
  DraftValidationResult,
  "owner" | "issues" | "validatedAt"
>;
type AnalysisReadyValidationResult = z.infer<typeof AnalysisReadyValidationResultSchema>;
type AnalysisReadyValidationOutcome = z.infer<typeof AnalysisReadyValidationOutcomeSchema>;
type CreateAnalysisReadyValidationOutcomeInput = Pick<
  AnalysisReadyValidationResult,
  "owner" | "issues" | "validatedAt"
>;

const createDraftValidationOutcome = (input: CreateDraftValidationOutcomeInput): DraftValidationOutcome =>
  DraftValidationOutcomeSchema.parse({
    validation: {
      schemaVersion: CURRENT_VALIDATION_RESULT_SCHEMA_VERSION,
      owner: input.owner,
      mode: "DRAFT",
      valid: !input.issues.some((issue) => issue.severity === "ERROR"),
      issues: input.issues,
      validatedAt: input.validatedAt,
    },
    saveAllowed: true,
  });

const createAnalysisReadyValidationOutcome = (
  input: CreateAnalysisReadyValidationOutcomeInput,
): AnalysisReadyValidationOutcome => {
  const valid = !input.issues.some((issue) => issue.severity === "ERROR");

  return AnalysisReadyValidationOutcomeSchema.parse({
    validation: {
      schemaVersion: CURRENT_VALIDATION_RESULT_SCHEMA_VERSION,
      owner: input.owner,
      mode: "ANALYSIS_READY",
      valid,
      issues: input.issues,
      validatedAt: input.validatedAt,
    },
    quantificationAllowed: valid,
  });
};

export {
  CURRENT_VALIDATION_RESULT_SCHEMA_VERSION,
  ValidationResultSchemaVersionSchema,
  ValidationModeSchema,
  ValidationSeveritySchema,
  ValidationFieldPathSegmentSchema,
  ValidationFieldPathSchema,
  ValidationIssueSchema,
  ValidationResultSchema,
  DraftValidationResultSchema,
  DraftValidationOutcomeSchema,
  AnalysisReadyValidationResultSchema,
  AnalysisReadyValidationOutcomeSchema,
  createDraftValidationOutcome,
  createAnalysisReadyValidationOutcome,
};
export type {
  ValidationResultSchemaVersion,
  ValidationMode,
  ValidationSeverity,
  ValidationFieldPathSegment,
  ValidationFieldPath,
  ValidationIssue,
  ValidationResult,
  DraftValidationResult,
  DraftValidationOutcome,
  CreateDraftValidationOutcomeInput,
  AnalysisReadyValidationResult,
  AnalysisReadyValidationOutcome,
  CreateAnalysisReadyValidationOutcomeInput,
};
