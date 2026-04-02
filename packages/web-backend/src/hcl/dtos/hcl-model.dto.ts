import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";

const hclModelSchema = z.object({
  title: z.string(),
  description: z.string(),
  assigned_users: z.array(z.number()),
});

export class HclModelDto extends createZodDto(hclModelSchema) {}
