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
  .union([z.literal(""), z.email("Invalid email format").max(254)]);

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

const ChangeEmailRequestSchema = z.object({
  newEmail: z.email("Invalid email format").max(254),
  currentPassword: z.string().min(1, "Current password is required"),
});
type ChangeEmailRequest = z.infer<typeof ChangeEmailRequestSchema>;

const ChangeUsernameRequestSchema = z.object({
  newUsername: z.string().trim().min(3, "Username must be at least 3 characters").max(32, "Username must be 32 characters or fewer"),
});
type ChangeUsernameRequest = z.infer<typeof ChangeUsernameRequestSchema>;

const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

const NotificationPrefsSchema = z.object({
  projectShared: z.boolean(),
  teamInvite: z.boolean(),
  runFinished: z.boolean(),
  quantErrors: z.boolean(),
});
type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

const UserPrefsSchema = z.object({
  notify: NotificationPrefsSchema,
});
type UserPrefs = z.infer<typeof UserPrefsSchema>;

const UpdateNotificationPrefsRequestSchema = z
  .object({
    projectShared: z.boolean().optional(),
    teamInvite: z.boolean().optional(),
    runFinished: z.boolean().optional(),
    quantErrors: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field is required" },
  );
type UpdateNotificationPrefsRequest = z.infer<typeof UpdateNotificationPrefsRequestSchema>;

const ChangeEmailResponseSchema = z.object({
  profile: UserProfileSchema,
  token: z.string(),
});
type ChangeEmailResponse = z.infer<typeof ChangeEmailResponseSchema>;

const ChangeUsernameResponseSchema = z.object({
  profile: UserProfileSchema,
  token: z.string(),
});
type ChangeUsernameResponse = z.infer<typeof ChangeUsernameResponseSchema>;

const ChangePasswordResponseSchema = z.object({
  detail: z.string(),
});
type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

export {
  UserProfileSchema,
  UpdateUserProfileRequestSchema,
  MyProfileResponseSchema,
  ChangeEmailRequestSchema,
  ChangeUsernameRequestSchema,
  ChangePasswordRequestSchema,
  NotificationPrefsSchema,
  UserPrefsSchema,
  UpdateNotificationPrefsRequestSchema,
  ChangeEmailResponseSchema,
  ChangeUsernameResponseSchema,
  ChangePasswordResponseSchema,
};
export type {
  UserProfile,
  UpdateUserProfileRequest,
  MyProfileResponse,
  ChangeEmailRequest,
  ChangeUsernameRequest,
  ChangePasswordRequest,
  NotificationPrefs,
  UserPrefs,
  UpdateNotificationPrefsRequest,
  ChangeEmailResponse,
  ChangeUsernameResponse,
  ChangePasswordResponse,
};
