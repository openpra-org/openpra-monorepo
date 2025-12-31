import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const userPreferencesSchema = z.object({
  preferences: z.object({
    theme: z.string().optional(),
    nodeIdsVisible: z.string().or(z.boolean()).optional(),
    outlineVisible: z.string().or(z.boolean()).optional(),
    nodeDescriptionEnabled: z.string().or(z.boolean()).optional(),
    node_value_visible: z.string().or(z.boolean()).optional(),
    pageBreaksVisible: z.string().or(z.boolean()).optional(),
  }),
});

/**
 * DTO for updating or returning user preferences.
 */
export class UserPreferencesDto extends createZodDto(userPreferencesSchema) {}
