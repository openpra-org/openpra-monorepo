import { title } from "process";
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

export class CreateNewColumnDto extends createZodDto(createNewColumnSchema) {}
