import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const hclModelTreeSchema = z.object({
    title: z.string(),
    description: z.string(),
    tree_type: z.string(),
    tree_data: z.object({}).default({}).optional()
});

export class HclModelTreeDto extends createZodDto(hclModelTreeSchema) {}