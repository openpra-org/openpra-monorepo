import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const createNewColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  dropdownOptions: z.array(
    z.object({
      number: z.number(),
      description: z.string(),
    }),
  ),
});
/**
 * DTO for adding an FMEA column with type and optional dropdown options.
 */
export class CreateNewColumnDto extends createZodDto(createNewColumnSchema) {}
