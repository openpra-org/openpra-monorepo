import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const hclModelTreeSchema = z.object({
    description: z.string(),
    title: z.string(),
    tree_data: z.object({}),
    tree_type: z.string()
});

export class HclModelTreeDto extends createZodDto(hclModelTreeSchema) {}