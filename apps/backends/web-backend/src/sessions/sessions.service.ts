import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { SessionInfo } from "interfaces-shared-types";
import { Session, type SessionDocument } from "./session.schema";

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

function parseUserAgent(userAgent: string): { device: string; browser: string } {
  const ua = userAgent.toLowerCase();
  let device = "Unknown device";
  if (ua.includes("windows")) device = "Windows";
  else if (ua.includes("iphone") || ua.includes("ipad")) device = "iOS";
  else if (ua.includes("mac os") || ua.includes("macintosh")) device = "macOS";
  else if (ua.includes("android")) device = "Android";
  else if (ua.includes("linux")) device = "Linux";
  let browser = "Unknown browser";
  if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  return { device, browser };
}

function formatLastActive(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

@Injectable()
export class SessionsService {
  constructor(@InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>) {}

  async create(input: { userId: string; jti: string; userAgent: string; ip: string; expiresAt: Date }): Promise<void> {
    await this.sessionModel.create({
      userId: input.userId,
      jti: input.jti,
      userAgent: input.userAgent,
      ip: input.ip,
      lastSeenAt: new Date(),
      expiresAt: input.expiresAt,
    });
  }

  async isActive(jti: string | undefined): Promise<boolean> {
    if (jti === undefined) return false;
    const count = await this.sessionModel.countDocuments({ jti }).exec();
    return count > 0;
  }

  async touch(jti: string): Promise<void> {
    const threshold = new Date(Date.now() - TOUCH_THROTTLE_MS);
    await this.sessionModel.updateOne({ jti, lastSeenAt: { $lt: threshold } }, { lastSeenAt: new Date() }).exec();
  }

  async listForUser(userId: string, currentJti: string | undefined): Promise<SessionInfo[]> {
    const docs = await this.sessionModel.find({ userId }).sort({ lastSeenAt: -1 }).exec();
    return docs.map((doc) => {
      const { device, browser } = parseUserAgent(doc.userAgent);
      return {
        id: String(doc._id),
        device,
        browser,
        lastActive: formatLastActive(doc.lastSeenAt),
        current: doc.jti === currentJti,
      };
    });
  }

  async revokeOne(userId: string, sessionId: string): Promise<void> {
    await this.sessionModel.deleteOne({ _id: sessionId, userId }).exec();
  }

  async revokeOthers(userId: string, currentJti: string): Promise<void> {
    await this.sessionModel.deleteMany({ userId, jti: { $ne: currentJti } }).exec();
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.sessionModel.deleteOne({ jti }).exec();
  }
}
