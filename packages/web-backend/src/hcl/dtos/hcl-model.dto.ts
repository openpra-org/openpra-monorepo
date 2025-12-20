import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const hclModelSchema = z.object({
  title: z.string(),
  description: z.string(),
  assigned_users: z.array(z.number()),
});
/**
 * DTO schema for creating a new HCL model with title, description and user assignments.
 */
export class HclModelDto extends createZodDto(hclModelSchema) {}
