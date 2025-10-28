/* Auto generated file DO NOT UPDATE.
To change the Zod Dto update the relevant schema file
 */

import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const CreateNewUserSchema = z
  .object({
    firstName: z.string().min(1).max(255).describe("Firstname of user"),
    lastName: z.string().min(1).max(255).describe("Lastname of user"),
    username: z.string().min(1).max(255).describe("Username"),
    email: z.string().min(5).max(255).describe("Email of user"),
    password: z.string().min(1).max(255).describe("Password of user"),
    roles: z.array(z.string().min(5).max(255)).describe("An array of role ids for the user"),
  })
  .describe("A new user in the backend");

/**
 * DTO for creating a new user.
 * Fields are derived from the Zod schema above.
 */
class CreateNewUserSchemaDto extends createZodDto(CreateNewUserSchema) {}

export { CreateNewUserSchemaDto };
