import { z } from "zod";

const NotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  actorUsername: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});
type Notification = z.infer<typeof NotificationSchema>;

const NotificationsResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

const UnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});
type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

const AuditLogEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  actorUsername: z.string(),
  summary: z.string(),
  createdAt: z.string(),
});
type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

const AuditLogResponseSchema = z.object({
  entries: z.array(AuditLogEntrySchema),
});
type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;

export {
  NotificationSchema,
  NotificationsResponseSchema,
  UnreadCountResponseSchema,
  AuditLogEntrySchema,
  AuditLogResponseSchema,
};
export type {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
  AuditLogEntry,
  AuditLogResponse,
};
