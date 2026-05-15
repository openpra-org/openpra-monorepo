import { z } from "zod";
import { createZodDto } from "../../zod/zod-dto";
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
export class UserPreferencesDto extends createZodDto(userPreferencesSchema) {}
