import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";
const paginationSchema = z.object({
  count: z.number(),
  next: z.string().or(z.null()),
  previous: z.string().or(z.null()),
  results: z.array(z.any()),
});
export class PaginationDto extends createZodDto(paginationSchema) {}
