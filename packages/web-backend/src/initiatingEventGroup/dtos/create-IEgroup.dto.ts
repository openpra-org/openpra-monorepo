import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const createNewInitiatingEventSchema = z.object({
  name: z.string(),
});

export class CreateNewUserDto extends createZodDto(
  createNewInitiatingEventSchema,
) {}
