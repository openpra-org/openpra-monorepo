import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const InitiatingEventGroupSchema = z.object({
  name: z.string(),
  initiatingEvents: z.array(z.string()),
});

export class InitiatingEventGroupDto extends createZodDto(
  InitiatingEventGroupSchema,
) {}
