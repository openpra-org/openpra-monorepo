import { z } from "zod";
import {
  WorkbookEntityIdSchema,
  WorkbookModelIdSchema,
  WorkbookModelAddressSchema,
  WorkbookRevisionSchema,
} from "../shared";
import { HclEvidenceScenarioSchema } from "./hcl-schemas";

// Typed application input for HCL_MH hazard_sweep.py. Generation runs in Rust.
const HclHazardSweepSpecSchema = z
  .object({
    dimensions: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(64),
            bnNode: WorkbookEntityIdSchema,
            states: z.array(WorkbookEntityIdSchema).min(1),
            stateLabels: z.record(z.string(), z.string()).optional(),
          })
          .strict(),
      )
      .min(1),
    excludedAssignments: z.array(z.record(z.string(), WorkbookEntityIdSchema)).optional(),
    maxScenarios: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict()
  .superRefine((spec, context) => {
    for (const key of ["id", "bnNode"] as const) {
      if (new Set(spec.dimensions.map((d) => d[key])).size !== spec.dimensions.length) {
        context.addIssue({ code: "custom", message: `Hazard dimensions require unique ${key} values` });
      }
    }
    for (const dim of spec.dimensions) {
      if (new Set(dim.states).size !== dim.states.length)
        context.addIssue({ code: "custom", message: "Dimension states must be unique" });
    }
    for (const exclusion of spec.excludedAssignments ?? []) {
      for (const [id, state] of Object.entries(exclusion)) {
        if (!spec.dimensions.some((dim) => dim.id === id && dim.states.includes(state))) {
          context.addIssue({ code: "custom", message: "Exclusion contains an unknown dimension or state" });
        }
      }
    }
  });
type HclHazardSweepSpec = z.infer<typeof HclHazardSweepSpecSchema>;

const HclGenerateScenariosRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    modelId: WorkbookModelIdSchema,
    workbookRevision: WorkbookRevisionSchema,
    dependencyConfiguration: WorkbookModelAddressSchema.optional(),
    spec: HclHazardSweepSpecSchema,
  })
  .strict();

const HclGenerateScenariosResultSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    scenarios: z.array(HclEvidenceScenarioSchema),
  })
  .strict();
type HclGenerateScenariosResult = z.infer<typeof HclGenerateScenariosResultSchema>;

export { HclHazardSweepSpecSchema, HclGenerateScenariosRequestSchema, HclGenerateScenariosResultSchema };
export type { HclHazardSweepSpec, HclGenerateScenariosResult };
