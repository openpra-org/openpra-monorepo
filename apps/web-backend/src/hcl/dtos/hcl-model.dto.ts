import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const hclModelSchema = z.object({
        assigned_users: z.array(z.number()),
        description: z.string(),
        title: z.string()
    })

export class HclModelDto extends createZodDto(hclModelSchema) {}