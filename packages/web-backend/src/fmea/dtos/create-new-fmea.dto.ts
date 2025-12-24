import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const createNewFmeaSchema = z.object({
  title: z.string(),
  description: z.string(),
});
/**
 * DTO for creating an FMEA with a title and description.
 */
export class CreateNewFmeaDto extends createZodDto(createNewFmeaSchema) {}
