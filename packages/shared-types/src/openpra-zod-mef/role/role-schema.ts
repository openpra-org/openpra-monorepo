/* Auto generated file DO NOT UPDATE.
To change the Zod Dto update the relevant schema file
 */

import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const PermissionSchema = z
  .array(
    z.object({
      action: z
        .union([z.string().min(5).max(255), z.array(z.string().min(5).max(255))])
        .describe("The actions that a role can perform"),
      subject: z
        .union([z.string().min(5).max(255), z.array(z.string().min(5).max(255))])
        .describe("The actions that a role can perform"),
      fields: z.any().optional(),
      conditionals: z.any().optional(),
      inverted: z.boolean().optional(),
      reason: z.string().min(1).max(255).optional(),
    }),
  )
  .describe("This will define the core permissions");

const RoleSchema = z
  .object({
    id: z.string().min(5).max(255).describe("The unique id for role"),
    name: z.string().min(5).max(255).describe("The name of the role"),
    permissions: PermissionSchema,
  })
  .describe("A role in the backend");

export class PermissionSchemaDto extends createZodDto(PermissionSchema) {}

export class RoleSchemaDto extends createZodDto(RoleSchema) {}
