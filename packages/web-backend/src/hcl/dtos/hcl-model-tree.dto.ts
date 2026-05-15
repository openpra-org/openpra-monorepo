import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";
const hclModelTreeSchema = z.object({
  title: z.string(),
  description: z.string(),
  tree_type: z.string(),
  tree_data: z.object({}).default({}).optional(),
});
export class HclModelTreeDto extends createZodDto(hclModelTreeSchema) {}
