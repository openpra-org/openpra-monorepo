import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const createNewUserSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    username: z.string(),
    email: z.string().email(),
    password: z.string()
});

export class CreateNewUserDto extends createZodDto(createNewUserSchema) {}