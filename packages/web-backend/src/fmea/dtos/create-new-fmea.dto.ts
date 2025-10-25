import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const createNewFmeaSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export class CreateNewFmeaDto extends createZodDto(createNewFmeaSchema) {}
