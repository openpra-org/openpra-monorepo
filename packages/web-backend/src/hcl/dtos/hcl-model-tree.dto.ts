import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const hclModelTreeSchema = z.object({
  title: z.string(),
  description: z.string(),
  tree_type: z.string(),
  tree_data: z.object({}).default({}).optional(),
});
/**
 * DTO for creating or returning a single HCL model tree entry.
 */
export class HclModelTreeDto extends createZodDto(hclModelTreeSchema) {}
