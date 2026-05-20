import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type {
  Notification as NotificationDto,
  NotificationsResponse,
  NotificationPrefs,
  UnreadCountResponse,
} from "interfaces-shared-types";
import { Notification, type NotificationDocument } from "./notification.schema";
import { User, type UserDocument } from "../users/user.schema";
import { EventBus } from "../events/event-bus";
import type { DomainEvent } from "../events/domain-events";

interface NotificationSpec {
  recipients: string[];
  type: string;
  title: string;
  body: string;
  link: string | null;
  prefKey: keyof NotificationPrefs | null;
}

function specFor(event: DomainEvent): NotificationSpec | null {
  switch (event.type) {
    case "team.invited":
      return {
        recipients: [event.target],
        type: event.type,
        title: `Invitation to ${event.teamName}`,
        body: `${event.actor} invited you to join the team.`,
        link: `/teams/${event.teamId}`,
        prefKey: "teamInvite",
      };
    case "team.kicked":
      return {
        recipients: [event.target],
        type: event.type,
        title: `Removed from ${event.teamName}`,
        body: `${event.actor} removed you from the team.`,
        link: null,
        prefKey: null,
      };
    case "team.admin_transferred":
      return {
        recipients: [event.target],
        type: event.type,
        title: `You are now admin of ${event.teamName}`,
        body: `${event.actor} transferred the admin role to you.`,
        link: `/teams/${event.teamId}`,
        prefKey: null,
      };
    case "team.lead_promoted":
      return {
        recipients: [event.target],
        type: event.type,
        title: `Promoted to lead in ${event.teamName}`,
        body: `${event.actor} made you a team lead.`,
        link: `/teams/${event.teamId}`,
        prefKey: null,
      };
    case "team.lead_demoted":
      return {
        recipients: [event.target],
        type: event.type,
        title: `Role changed in ${event.teamName}`,
        body: `${event.actor} changed your role back to member.`,
        link: `/teams/${event.teamId}`,
        prefKey: null,
      };
    case "project.shared_user":
      return {
        recipients: [event.target],
        type: event.type,
        title: `Project shared: ${event.projectName}`,
        body: `${event.actor} shared a project with you as ${event.role}.`,
        link: "/projects",
        prefKey: "projectShared",
      };
    case "project.shared_team":
      return {
        recipients: event.teamMembers.filter((u) => u !== event.actor),
        type: event.type,
        title: `Project shared with ${event.teamName}`,
        body: `${event.actor} shared "${event.projectName}" with your team as ${event.role}.`,
        link: "/projects",
        prefKey: "projectShared",
      };
    default:
      return null;
  }
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.handle(event));
  }

  async handle(event: DomainEvent): Promise<void> {
    const spec = specFor(event);
    if (spec === null) return;
    for (const recipient of spec.recipients) {
      if (recipient === event.actor) continue;
      if (spec.prefKey !== null && !(await this.wantsNotification(recipient, spec.prefKey))) continue;
      await this.notificationModel.create({
        recipientUsername: recipient,
        type: spec.type,
        title: spec.title,
        body: spec.body,
        link: spec.link,
        actorUsername: event.actor,
      });
    }
  }

  async list(username: string): Promise<NotificationsResponse> {
    const docs = await this.notificationModel
      .find({ recipientUsername: username })
      .sort({ createdAt: -1 })
      .limit(30)
      .exec();
    const unreadCount = await this.notificationModel
      .countDocuments({ recipientUsername: username, readAt: null })
      .exec();
    return { notifications: docs.map(toDto), unreadCount };
  }

  async unreadCount(username: string): Promise<UnreadCountResponse> {
    const unreadCount = await this.notificationModel
      .countDocuments({ recipientUsername: username, readAt: null })
      .exec();
    return { unreadCount };
  }

  async markRead(id: string, username: string): Promise<void> {
    if (!isValidObjectId(id)) throw new NotFoundException("Notification not found");
    const doc = await this.notificationModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Notification not found");
    if (doc.recipientUsername !== username) throw new ForbiddenException("Not your notification");
    if (doc.readAt === null) {
      doc.readAt = new Date();
      await doc.save();
    }
  }

  async markAllRead(username: string): Promise<void> {
    await this.notificationModel
      .updateMany({ recipientUsername: username, readAt: null }, { $set: { readAt: new Date() } })
      .exec();
  }

  private async wantsNotification(username: string, prefKey: keyof NotificationPrefs): Promise<boolean> {
    const user = await this.userModel.findOne({ username }).lean();
    if (!user) return false;
    return user.prefs?.notify?.[prefKey] ?? true;
  }
}

function toDto(doc: NotificationDocument): NotificationDto {
  const createdAt = (doc as NotificationDocument & { createdAt?: Date }).createdAt ?? new Date();
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    link: doc.link,
    actorUsername: doc.actorUsername,
    read: doc.readAt !== null,
    createdAt: createdAt.toISOString(),
  };
}
