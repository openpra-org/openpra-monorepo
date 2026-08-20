import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "crypto";
import { Model, isValidObjectId } from "mongoose";
import { SessionsService } from "../sessions/sessions.service";
import { User, type UserDocument } from "../users/user.schema";
import { Project, type ProjectDocument } from "../projects/project.schema";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { PosWorkbook, type PosWorkbookDocument } from "../pos-workbooks/pos-workbook.schema";
import { UsageEvent, type UsageEventDocument, type UsageEventType } from "./usage-event.schema";
import { DailyAggregate, type DailyAggregateDocument } from "./daily-aggregate.schema";
import { Campaign, type CampaignDocument } from "./campaign.schema";
import { CampaignVisit, type CampaignVisitDocument } from "./campaign-visit.schema";

const MAX_BATCH_SIZE = 100;
const MAX_TIME_BUCKET_MS = 5 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

interface ClientUsageEvent {
  type: "feature_used" | "element_time";
  sessionId?: string;
  projectId?: string;
  workbookId?: string;
  technicalElement?: string;
  projectType?: string;
  reactorType?: string;
  feature?: string;
  activeMs?: number;
  idleMs?: number;
  occurredAt?: string;
}

interface EventContext {
  userId: string;
  username: string;
}

interface RangeQuery {
  start?: string;
  end?: string;
  reactorType?: string;
}

interface MetricPoint {
  label: string;
  count: number;
}

interface TimePoint {
  label: string;
  activeMs: number;
  idleMs: number;
  totalMs: number;
}

function asDate(value: string | undefined, fallback: Date): Date {
  if (value === undefined || value.length === 0) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function rangeDate(value: string | undefined, fallback: Date, endOfDay = false): Date {
  if (value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  return asDate(value, fallback);
}

function safeString(value: unknown, max = 100): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

function safeMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_TIME_BUCKET_MS, Math.round(value)));
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function reactorTypeFromMef(mef: unknown): string | null {
  if (mef === null || typeof mef !== "object") return null;
  const metadata = (mef as Record<string, unknown>)["metadata"];
  if (metadata === null || typeof metadata !== "object") return null;
  const identity = (metadata as Record<string, unknown>)["plantIdentity"];
  if (identity === null || typeof identity !== "object") return null;
  return safeString((identity as Record<string, unknown>)["reactorType"], 100);
}

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private aggregationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectModel(UsageEvent.name) private readonly eventModel: Model<UsageEventDocument>,
    @InjectModel(DailyAggregate.name) private readonly dailyModel: Model<DailyAggregateDocument>,
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignVisit.name) private readonly visitModel: Model<CampaignVisitDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    private readonly sessions: SessionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapAdmins();
    const intervalMs = Math.max(60_000, Number(process.env["ANALYTICS_AGGREGATION_INTERVAL_MS"] ?? 300_000));
    this.aggregationTimer = setInterval(() => {
      void this.rebuildRecentAggregates().catch((error: unknown) => {
        console.error("Analytics aggregation failed", error);
      });
    }, intervalMs);
    this.aggregationTimer.unref();
    void this.rebuildRecentAggregates().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.aggregationTimer !== null) clearInterval(this.aggregationTimer);
  }

  async ingest(events: ClientUsageEvent[], context: EventContext): Promise<{ accepted: number }> {
    if (!Array.isArray(events) || events.length === 0) return { accepted: 0 };
    if (events.length > MAX_BATCH_SIZE) throw new BadRequestException(`At most ${MAX_BATCH_SIZE} events per request`);
    const now = new Date();
    const docs = events.flatMap((event) => {
      if (event.type !== "feature_used" && event.type !== "element_time") return [];
      const occurredAt = asDate(event.occurredAt, now);
      if (Math.abs(occurredAt.getTime() - now.getTime()) > 24 * 60 * 60 * 1000) occurredAt.setTime(now.getTime());
      const feature = safeString(event.feature);
      const technicalElement = safeString(event.technicalElement, 24);
      if (event.type === "feature_used" && feature === null) return [];
      if (event.type === "element_time" && technicalElement === null) return [];
      return [{
        type: event.type,
        userId: context.userId,
        username: context.username,
        sessionId: safeString(event.sessionId),
        projectId: safeString(event.projectId),
        workbookId: safeString(event.workbookId),
        technicalElement,
        projectType: safeString(event.projectType),
        reactorType: safeString(event.reactorType),
        feature,
        activeMs: safeMs(event.activeMs),
        idleMs: safeMs(event.idleMs),
        campaignId: null,
        occurredAt,
      }];
    });
    if (docs.length > 0) {
      const workbookIds = docs.map((doc) => doc.workbookId).filter((id): id is string => id !== null && isValidObjectId(id));
      const workbooks = workbookIds.length === 0 ? [] : await this.workbookModel.find({ _id: { $in: workbookIds } }).lean();
      const workbookMap = new Map(workbooks.map((workbook) => [String(workbook._id), workbook]));
      const projectIds = Array.from(new Set([
        ...docs.map((doc) => doc.projectId),
        ...workbooks.map((workbook) => workbook.projectId),
      ].filter((id): id is string => id !== null && isValidObjectId(id))));
      const [projects, posWorkbooks] = await Promise.all([
        projectIds.length === 0 ? [] : this.projectModel.find({ _id: { $in: projectIds } }).lean(),
        projectIds.length === 0 ? [] : this.posWorkbookModel.find({ projectId: { $in: projectIds } }).lean(),
      ]);
      const projectMap = new Map(projects.map((project) => [String(project._id), project]));
      const reactorMap = new Map(posWorkbooks.flatMap((workbook) => {
        const reactorType = reactorTypeFromMef(workbook.mef);
        return reactorType === null ? [] : [[workbook.projectId, reactorType] as const];
      }));
      for (const doc of docs) {
        const workbook = doc.workbookId === null ? undefined : workbookMap.get(doc.workbookId);
        if (doc.projectId === null && workbook !== undefined) doc.projectId = workbook.projectId;
        if (doc.technicalElement === null && workbook !== undefined) doc.technicalElement = workbook.elementCode;
        const project = doc.projectId === null ? undefined : projectMap.get(doc.projectId);
        if (doc.projectType === null && project !== undefined) doc.projectType = project.mode;
        if (doc.reactorType === null && doc.projectId !== null) doc.reactorType = reactorMap.get(doc.projectId) ?? null;
      }
      await this.eventModel.insertMany(docs, { ordered: false });
    }
    return { accepted: docs.length };
  }

  async recordAccountCreated(user: UserDocument, campaignToken?: string, visitorId?: string): Promise<void> {
    await this.eventModel.create({
      type: "account_created",
      userId: String(user._id),
      username: user.username,
      occurredAt: new Date(),
    });
    if (campaignToken !== undefined && campaignToken.length > 0) {
      await this.attributeSignup(campaignToken, visitorId ?? "", user);
    }
  }

  async recordProjectCreated(input: { userId: string; username: string; projectId: string; projectType: string }): Promise<void> {
    await this.eventModel.create({
      type: "project_created",
      ...input,
      occurredAt: new Date(),
    });
  }

  async recordWorkbookCreated(input: { userId: string; username: string; projectId: string; workbookId: string; technicalElement: string; projectType: string }): Promise<void> {
    await this.eventModel.create({
      type: "workbook_created",
      ...input,
      occurredAt: new Date(),
    });
  }

  async openCampaign(token: string, visitorIdInput: string): Promise<{ name: string; destinationPath: string; token: string }> {
    const campaign = await this.campaignModel.findOne({ token }).exec();
    if (campaign === null || !campaign.active || (campaign.expiresAt !== null && campaign.expiresAt.getTime() <= Date.now())) {
      throw new NotFoundException("This invitation link is unavailable or has expired");
    }
    const visitorId = safeString(visitorIdInput, 100) ?? randomBytes(12).toString("hex");
    const now = new Date();
    const visitResult = await this.visitModel.updateOne(
      { campaignId: String(campaign._id), visitorId },
      {
        $setOnInsert: { firstOpenedAt: now },
        $set: { lastOpenedAt: now },
        $inc: { openCount: 1 },
      },
      { upsert: true },
    ).exec();
    await this.campaignModel.updateOne(
      { _id: campaign._id },
      {
        $inc: { openCount: 1, uniqueOpenCount: visitResult.upsertedCount > 0 ? 1 : 0 },
        $set: { lastOpenedAt: now },
      },
    ).exec();
    await this.eventModel.create({
      type: "campaign_open",
      campaignId: String(campaign._id),
      sessionId: visitorId,
      occurredAt: now,
    });
    return { name: campaign.name, destinationPath: campaign.destinationPath, token: campaign.token };
  }

  async createCampaign(input: { name?: string; destinationPath?: string; expiresAt?: string | null }, actor: string): Promise<Record<string, unknown>> {
    const name = safeString(input.name, 120);
    if (name === null) throw new BadRequestException("Campaign name is required");
    const destinationPath = safeString(input.destinationPath, 250) ?? "/auth?signup=1";
    if (!destinationPath.startsWith("/") || destinationPath.startsWith("//")) {
      throw new BadRequestException("Destination must be an in-app path");
    }
    const expiresAt = input.expiresAt === null || input.expiresAt === undefined || input.expiresAt === ""
      ? null
      : rangeDate(input.expiresAt, new Date(0), true);
    if (expiresAt !== null && expiresAt.getTime() <= Date.now()) throw new BadRequestException("Expiration must be in the future");
    let token = randomBytes(12).toString("base64url");
    while (await this.campaignModel.exists({ token })) token = randomBytes(12).toString("base64url");
    const created = await this.campaignModel.create({ name, destinationPath, expiresAt, token, createdBy: actor });
    return this.campaignDto(created, []);
  }

  async setCampaignActive(id: string, active: boolean): Promise<Record<string, unknown>> {
    if (!isValidObjectId(id)) throw new NotFoundException("Campaign not found");
    const campaign = await this.campaignModel.findByIdAndUpdate(id, { active }, { new: true }).exec();
    if (campaign === null) throw new NotFoundException("Campaign not found");
    const users = await this.attributedUsers(String(campaign._id));
    return this.campaignDto(campaign, users);
  }

  async listCampaigns(): Promise<Record<string, unknown>[]> {
    const campaigns = await this.campaignModel.find().sort({ createdAt: -1 }).exec();
    const userDocs = await this.userModel.find({ "signupAttribution.campaignId": { $ne: null } }).lean();
    const byCampaign = new Map<string, Array<Record<string, string>>>();
    for (const user of userDocs) {
      const attribution = user.signupAttribution;
      if (attribution?.campaignId === undefined || attribution.campaignId === null) continue;
      const rows = byCampaign.get(attribution.campaignId) ?? [];
      rows.push({ username: user.username, email: user.email, fullName: user.fullName, createdAt: ((user as typeof user & { createdAt?: Date }).createdAt ?? new Date()).toISOString() });
      byCampaign.set(attribution.campaignId, rows);
    }
    return campaigns.map((campaign) => this.campaignDto(campaign, byCampaign.get(String(campaign._id)) ?? []));
  }

  async dashboard(query: RangeQuery): Promise<Record<string, unknown>> {
    const now = new Date();
    const start = rangeDate(query.start, new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86_400_000));
    const end = rangeDate(query.end, now, true);
    if (start > end) throw new BadRequestException("Start date must be before end date");
    const eventMatch: Record<string, unknown> = { occurredAt: { $gte: start, $lte: end } };
    if (query.reactorType !== undefined && query.reactorType.length > 0) eventMatch["reactorType"] = query.reactorType;
    const createdMatch = { createdAt: { $gte: start, $lte: end } };
    let reactorProjectIds: string[] | null = null;
    if (query.reactorType !== undefined && query.reactorType.length > 0) {
      const posWorkbooks = await this.posWorkbookModel.find({ "mef.metadata.plantIdentity.reactorType": query.reactorType }).lean();
      reactorProjectIds = Array.from(new Set(posWorkbooks.map((workbook) => workbook.projectId)));
    }
    const projectCreatedMatch: Record<string, unknown> = {
      ...createdMatch,
      ...(reactorProjectIds === null ? {} : { _id: { $in: reactorProjectIds } }),
    };
    const workbookCreatedMatch: Record<string, unknown> = {
      ...createdMatch,
      ...(reactorProjectIds === null ? {} : { projectId: { $in: reactorProjectIds } }),
    };

    const [
      elementTime,
      sessionRanking,
      accountTrend,
      activeUsers,
      newUsers,
      projects,
      workbooks,
      reactorTypes,
    ] = await Promise.all([
      this.timeCounts({ ...eventMatch, type: "element_time" }, "$technicalElement"),
      this.sessionTimeCounts(eventMatch),
      this.accountTrend(createdMatch),
      this.eventModel.distinct("username", { ...eventMatch, username: { $ne: null } }),
      this.userModel.find(createdMatch).sort({ createdAt: -1 }).limit(500).lean(),
      this.projectModel.find(projectCreatedMatch).lean(),
      this.workbookModel.find(workbookCreatedMatch).lean(),
      this.eventModel.distinct("reactorType", { reactorType: { $nin: [null, ""] } }),
    ]);

    const activeMs = elementTime.reduce((sum, item) => sum + item.activeMs, 0);
    const idleMs = elementTime.reduce((sum, item) => sum + item.idleMs, 0);
    const projectModes = new Map<string, number>();
    for (const project of projects) projectModes.set(project.mode, (projectModes.get(project.mode) ?? 0) + 1);
    const workbookTypes = new Map<string, number>();
    for (const workbook of workbooks) workbookTypes.set(workbook.elementCode, (workbookTypes.get(workbook.elementCode) ?? 0) + 1);
    const projectTypes = Array.from(projectModes, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    const technicalElementWorkbooks = Array.from(workbookTypes, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    return {
      range: { start: start.toISOString(), end: end.toISOString(), reactorType: query.reactorType ?? "" },
      summary: {
        accountsCreated: newUsers.length,
        activeUsers: activeUsers.filter((value): value is string => typeof value === "string").length,
        projectsCreated: projects.length,
        trackedHours: (activeMs + idleMs) / 3_600_000,
      },
      accountTrend,
      activeIdle: { activeMs, idleMs },
      sessionRanking,
      projectTypes,
      technicalElementWorkbooks,
      reactorTypes: reactorTypes.filter((value): value is string => typeof value === "string"),
      idleThresholdSeconds: Number(process.env["ANALYTICS_IDLE_THRESHOLD_SECONDS"] ?? 120),
    };
  }

  async dashboardCsv(query: RangeQuery): Promise<string> {
    const data = await this.dashboard(query) as {
      accountTrend: MetricPoint[];
      projectTypes: MetricPoint[];
      technicalElementWorkbooks: MetricPoint[];
    };
    const rows: string[][] = [["section", "label", "count"]];
    for (const row of data.accountTrend) rows.push(["accounts", row.label, String(row.count)]);
    for (const row of data.projectTypes) rows.push(["project_type", row.label, String(row.count)]);
    for (const row of data.technicalElementWorkbooks) rows.push(["technical_element_workbooks", row.label, String(row.count)]);
    return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  }

  async listAdminUsers(): Promise<Array<Record<string, unknown>>> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).lean();
    return users.map((user) => ({
      id: String(user._id),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      organization: user.organization,
      isAdmin: user.roles.includes("admin-role"),
      createdAt: ((user as typeof user & { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
    }));
  }

  async setAdmin(userId: string, isAdmin: boolean, actor: EventContext): Promise<void> {
    if (!isValidObjectId(userId)) throw new NotFoundException("User not found");
    const user = await this.userModel.findById(userId).exec();
    if (user === null) throw new NotFoundException("User not found");
    if (!isAdmin && user.username === actor.username) throw new ConflictException("You cannot remove your own administrator access");
    if (isAdmin && !user.roles.includes("admin-role")) user.roles.push("admin-role");
    if (!isAdmin) user.roles = user.roles.filter((role) => role !== "admin-role");
    await user.save();
    await this.sessions.revokeAllForUser(String(user._id));
    await this.eventModel.create({
      type: "admin_role_changed",
      userId: actor.userId,
      username: actor.username,
      feature: `${isAdmin ? "granted" : "revoked"}:${user.username}`,
      occurredAt: new Date(),
    });
  }

  private async bootstrapAdmins(): Promise<void> {
    const emails = (process.env["ADMIN_BOOTSTRAP_EMAILS"] ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    const usernames = (process.env["ADMIN_BOOTSTRAP_USERNAMES"] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (emails.length === 0 && usernames.length === 0) return;
    await this.userModel.updateMany(
      { $or: [{ email: { $in: emails } }, { username: { $in: usernames } }] },
      { $addToSet: { roles: "admin-role" } },
    ).exec();
  }

  private async attributeSignup(token: string, visitorId: string, user: UserDocument): Promise<void> {
    const cleanedToken = safeString(token, 100);
    if (cleanedToken === null) return;
    const campaign = await this.campaignModel.findOne({ token: cleanedToken, active: true }).exec();
    if (campaign === null || (campaign.expiresAt !== null && campaign.expiresAt.getTime() <= Date.now())) return;
    const now = new Date();
    const cleanedVisitorId = safeString(visitorId, 100) ?? "";
    user.signupAttribution = { campaignId: String(campaign._id), campaignName: campaign.name, visitorId: cleanedVisitorId, attributedAt: now };
    user.markModified("signupAttribution");
    await user.save();
    await this.campaignModel.updateOne({ _id: campaign._id }, { $inc: { signupCount: 1 } }).exec();
    if (cleanedVisitorId.length > 0) {
      await this.visitModel.updateOne(
        { campaignId: String(campaign._id), visitorId: cleanedVisitorId },
        { $set: { attributedUsername: user.username, attributedAt: now } },
      ).exec();
    }
  }

  private async attributedUsers(campaignId: string): Promise<Array<Record<string, string>>> {
    const users = await this.userModel.find({ "signupAttribution.campaignId": campaignId }).lean();
    return users.map((user) => ({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      createdAt: ((user as typeof user & { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
    }));
  }

  private campaignDto(campaign: CampaignDocument, attributedUsers: Array<Record<string, string>>): Record<string, unknown> {
    return {
      id: String(campaign._id),
      name: campaign.name,
      token: campaign.token,
      destinationPath: campaign.destinationPath,
      active: campaign.active,
      expiresAt: campaign.expiresAt?.toISOString() ?? null,
      openCount: campaign.openCount,
      uniqueOpenCount: campaign.uniqueOpenCount,
      signupCount: attributedUsers.length,
      lastOpenedAt: campaign.lastOpenedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      createdBy: campaign.createdBy,
      attributedUsers,
    };
  }

  private async timeCounts(match: Record<string, unknown>, field: string): Promise<TimePoint[]> {
    const rows = await this.eventModel.aggregate<{ _id: string | null; activeMs: number; idleMs: number }>([
      { $match: match },
      { $group: { _id: field, activeMs: { $sum: "$activeMs" }, idleMs: { $sum: "$idleMs" } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { activeMs: -1, idleMs: -1 } },
    ]).exec();
    return rows.map((row) => ({ label: row._id ?? "Unknown", activeMs: row.activeMs, idleMs: row.idleMs, totalMs: row.activeMs + row.idleMs }));
  }

  private async sessionTimeCounts(match: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    const rows = await this.eventModel.aggregate<{ _id: { sessionId: string; technicalElement: string; username: string }; activeMs: number; idleMs: number }>([
      { $match: { ...match, type: "element_time", sessionId: { $nin: [null, ""] } } },
      { $group: { _id: { sessionId: "$sessionId", technicalElement: "$technicalElement", username: "$username" }, activeMs: { $sum: "$activeMs" }, idleMs: { $sum: "$idleMs" } } },
      { $sort: { activeMs: -1, idleMs: -1 } },
      { $limit: 100 },
    ]).exec();
    return rows.map((row) => ({ ...row._id, activeMs: row.activeMs, idleMs: row.idleMs, totalMs: row.activeMs + row.idleMs }));
  }

  private async accountTrend(match: Record<string, unknown>): Promise<MetricPoint[]> {
    const rows = await this.userModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec();
    return rows.map((row) => ({ label: row._id, count: row.count }));
  }

  private async rebuildRecentAggregates(): Promise<void> {
    const since = new Date(Date.now() - 3 * 86_400_000);
    const rows = await this.eventModel.aggregate<{ _id: { date: string; metric: UsageEventType; dimension: string; reactorType: string }; count: number; activeMs: number; idleMs: number }>([
      { $match: { occurredAt: { $gte: since } } },
      { $project: {
        date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
        metric: "$type",
        dimension: { $ifNull: ["$feature", { $ifNull: ["$technicalElement", { $ifNull: ["$projectType", ""] }] }] },
        reactorType: { $ifNull: ["$reactorType", ""] }, activeMs: 1, idleMs: 1,
      } },
      { $group: { _id: { date: "$date", metric: "$metric", dimension: "$dimension", reactorType: "$reactorType" }, count: { $sum: 1 }, activeMs: { $sum: "$activeMs" }, idleMs: { $sum: "$idleMs" } } },
    ]).exec();
    const firstDate = since.toISOString().slice(0, 10);
    await this.dailyModel.deleteMany({ date: { $gte: firstDate } }).exec();
    if (rows.length > 0) {
      await this.dailyModel.insertMany(rows.map((row) => ({ ...row._id, count: row.count, activeMs: row.activeMs, idleMs: row.idleMs })), { ordered: false });
    }
  }
}

export type { ClientUsageEvent, RangeQuery };
