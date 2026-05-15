import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";
const createNewFmeaSchema = z.object({
  title: z.string(),
  description: z.string(),
});
export class CreateNewFmeaDto extends createZodDto(createNewFmeaSchema) {}
