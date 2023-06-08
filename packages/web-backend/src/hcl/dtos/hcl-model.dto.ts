import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const hclModelSchema = z.object({
    title: z.string(),
    description: z.string(),
    assigned_users: z.array(z.number())
});

export class HclModelDto extends createZodDto(hclModelSchema) {}