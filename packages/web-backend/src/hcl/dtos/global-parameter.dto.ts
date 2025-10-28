import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const globalParameterSchema = z.object({
  parameter_name: z.string(),
  double_value: z.string().or(z.number()).optional(),
  string_value: z.string().optional(),
});
/**
 * DTO for HCL global parameter updates or creation.
 */
export class GlobalParameterDto extends createZodDto(globalParameterSchema) {}
