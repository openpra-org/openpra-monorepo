import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const paginationSchema = z.object({
  count: z.number(),
  next: z.string().or(z.null()),
  previous: z.string().or(z.null()),
  results: z.array(z.any()),
});

/**
 * Pagination envelope for list responses.
 * Contains total count, next/previous links, and an array of results.
 */
export class PaginationDto extends createZodDto(paginationSchema) {}
