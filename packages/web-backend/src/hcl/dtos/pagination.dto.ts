import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const paginationSchema = z.object({
  count: z.number(),
  next: z.string().or(z.null()),
  previous: z.string().or(z.null()),
  results: z.array(z.any()),
});

export class PaginationDto extends createZodDto(paginationSchema) {}
