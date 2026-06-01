import { z } from "zod";
import { ConnectedAccountSchema } from "../auth/OAuthSchema";

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
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  signatureDataUrl: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  hasPassword: z.boolean(),
  connectedAccounts: z.array(ConnectedAccountSchema),
});
type UserProfile = z.infer<typeof UserProfileSchema>;

function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

const optionalEmailField = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || looksLikeEmail(v), { message: "Invalid email format" });

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

const PublicUserProfileSchema = z.object({
  username: z.string(),
  fullName: z.string(),
  organization: z.string(),
  title: z.string(),
  bio: z.string(),
  linkedin: z.string(),
  initials: z.string(),
  memberSince: z.string(),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
});
type PublicUserProfile = z.infer<typeof PublicUserProfileSchema>;

const UserSearchHitSchema = z.object({
  username: z.string(),
  fullName: z.string(),
  initials: z.string(),
  organization: z.string(),
  avatarUrl: z.string().nullable(),
});
type UserSearchHit = z.infer<typeof UserSearchHitSchema>;

const UserSearchResponseSchema = z.object({
  users: z.array(UserSearchHitSchema),
});
type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

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

const SessionInfoSchema = z.object({
  id: z.string(),
  device: z.string(),
  browser: z.string(),
  lastActive: z.string(),
  current: z.boolean(),
});
type SessionInfo = z.infer<typeof SessionInfoSchema>;

const SessionListResponseSchema = z.object({
  sessions: z.array(SessionInfoSchema),
});
type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

const SignatureResponseSchema = z.object({
  signatureDataUrl: z.string().nullable(),
});
type SignatureResponse = z.infer<typeof SignatureResponseSchema>;

const SaveSignatureRequestSchema = z.object({
  signatureDataUrl: z.string().min(1),
});
type SaveSignatureRequest = z.infer<typeof SaveSignatureRequestSchema>;

export {
  UserProfileSchema,
  UpdateUserProfileRequestSchema,
  MyProfileResponseSchema,
  PublicUserProfileSchema,
  UserSearchHitSchema,
  UserSearchResponseSchema,
  ChangeEmailRequestSchema,
  ChangeUsernameRequestSchema,
  ChangePasswordRequestSchema,
  NotificationPrefsSchema,
  UserPrefsSchema,
  UpdateNotificationPrefsRequestSchema,
  ChangeEmailResponseSchema,
  ChangeUsernameResponseSchema,
  ChangePasswordResponseSchema,
  SessionInfoSchema,
  SessionListResponseSchema,
  SignatureResponseSchema,
  SaveSignatureRequestSchema,
};
export type {
  UserProfile,
  UpdateUserProfileRequest,
  MyProfileResponse,
  PublicUserProfile,
  UserSearchHit,
  UserSearchResponse,
  ChangeEmailRequest,
  ChangeUsernameRequest,
  ChangePasswordRequest,
  NotificationPrefs,
  UserPrefs,
  UpdateNotificationPrefsRequest,
  ChangeEmailResponse,
  ChangeUsernameResponse,
  ChangePasswordResponse,
  SessionInfo,
  SessionListResponse,
  SignatureResponse,
  SaveSignatureRequest,
};
