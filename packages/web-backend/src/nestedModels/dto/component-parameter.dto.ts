import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";
const createComponentParameterSchema = z.object({
  componentType: z.string().min(1),
  componentFailureMode: z.string().min(1),
  grouping: z.string().optional(),
  description: z.string().optional(),
  dataSource: z.string().optional(),
  failures: z.number().nonnegative().optional(),
  units: z.string().optional(),
  dhUnit: z.string().optional(),
  dhValue: z.number().nonnegative().optional(),
  componentCount: z.number().int().nonnegative().optional(),
  distribution: z.string().optional(),
  analysisType: z.string().optional(),
  fth: z.number().optional(),
  median: z.number().optional(),
  nfth: z.number().optional(),
  alpha: z.number().optional(),
  beta: z.number().optional(),
  mean: z.number().optional(),
  errorFactor: z.number().optional(),
  dateRange: z.string().optional(),
  effectiveDate: z.string().optional(),
});
const updateComponentParameterSchema = createComponentParameterSchema.partial();
export class CreateComponentParameterDto extends createZodDto(createComponentParameterSchema) {}
export class UpdateComponentParameterDto extends createZodDto(updateComponentParameterSchema) {}
export type CreateComponentParameterBody = z.infer<typeof createComponentParameterSchema>;
export type UpdateComponentParameterBody = z.infer<typeof updateComponentParameterSchema>;
