import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";

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

export class CreateNewColumnDto extends createZodDto(createNewColumnSchema) {}
