import { z } from "zod";

const UserProfileSchema = z.object({
  username: z.string(),
  email: z.string(),
  fullName: z.string(),
  organization: z.string(),
  title: z.string(),
  bio: z.string(),
  altEmail: z.string(),
  phone: z.string(),
  linkedin: z.string(),
  initials: z.string(),
  memberSince: z.string(),
});
type UserProfile = z.infer<typeof UserProfileSchema>;

const optionalEmailField = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), { message: "Invalid email format" });

const UpdateUserProfileRequestSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(120).optional(),
    organization: z.string().trim().max(120).optional(),
    title: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(400, "Bio must be 400 characters or fewer").optional(),
    altEmail: optionalEmailField.optional(),
    phone: z.string().trim().max(40).optional(),
    linkedin: z.string().trim().max(200).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field is required" },
  );
type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;

const MyProfileResponseSchema = z.object({
  profile: UserProfileSchema,
  projectCount: z.number().int().nonnegative(),
});
type MyProfileResponse = z.infer<typeof MyProfileResponseSchema>;

export { UserProfileSchema, UpdateUserProfileRequestSchema, MyProfileResponseSchema };
export type { UserProfile, UpdateUserProfileRequest, MyProfileResponse };
