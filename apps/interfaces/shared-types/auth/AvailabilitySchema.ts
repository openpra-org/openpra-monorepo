import { z } from "zod";

const AvailabilityResponseSchema = z.object({
  usernameAvailable: z.boolean().optional(),
  emailAvailable: z.boolean().optional(),
});
type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;

export { AvailabilityResponseSchema };
export type { AvailabilityResponse };
