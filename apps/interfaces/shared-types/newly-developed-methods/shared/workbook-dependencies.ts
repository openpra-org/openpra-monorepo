import { z } from "zod";
import {
  WorkbookCrossReferenceSchema,
  WorkbookModelAddressSchema,
} from "./method-model";
import type {
  WorkbookCrossReference,
  WorkbookModelAddress,
} from "./method-model";

const WorkbookMethodHostTypeSchema = z.enum(["SY", "ES", "ESQ"]);
const WorkbookReferencePathSchema = z
  .string()
  .startsWith("/", "Reference path must be a JSON pointer");
const WorkbookDependencyReferenceSchema = z.union([
  WorkbookCrossReferenceSchema,
  WorkbookModelAddressSchema,
]);

const WorkbookModelDependencySchema = z
  .object({
    sourceHostType: WorkbookMethodHostTypeSchema,
    sourceWorkbookId: z.string().trim().min(1, "Source workbook id is required"),
    path: WorkbookReferencePathSchema,
    reference: WorkbookDependencyReferenceSchema,
  })
  .strict();

const WorkbookModelDependenciesResponseSchema = z
  .object({
    target: WorkbookModelAddressSchema,
    dependencies: z.array(WorkbookModelDependencySchema),
  })
  .strict();

type WorkbookMethodHostType = z.infer<typeof WorkbookMethodHostTypeSchema>;
type WorkbookReferencePath = z.infer<typeof WorkbookReferencePathSchema>;
type WorkbookDependencyReference = WorkbookCrossReference | WorkbookModelAddress;
type WorkbookModelDependency = z.infer<typeof WorkbookModelDependencySchema>;
type WorkbookModelDependenciesResponse = z.infer<
  typeof WorkbookModelDependenciesResponseSchema
>;

export {
  WorkbookMethodHostTypeSchema,
  WorkbookReferencePathSchema,
  WorkbookDependencyReferenceSchema,
  WorkbookModelDependencySchema,
  WorkbookModelDependenciesResponseSchema,
};
export type {
  WorkbookMethodHostType,
  WorkbookReferencePath,
  WorkbookDependencyReference,
  WorkbookModelDependency,
  WorkbookModelDependenciesResponse,
};
