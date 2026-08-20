import { Injectable, NotFoundException, OnModuleInit, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type {
  OrgSearchHit,
  OrgSearchResponse,
  OrgSummary,
} from "interfaces-shared-types";
import { Organization, type OrganizationDocument } from "./organization.schema";
import { User, type UserDocument } from "../users/user.schema";
import { Team, type TeamDocument } from "../teams/team.schema";

function slugify(name: string): string {
  const lower = name.trim().toLowerCase();
  let out = "";
  let lastWasDash = false;
  for (const ch of lower) {
    const code = ch.charCodeAt(0);
    const isAlnum = (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
    if (isAlnum) {
      out += ch;
      lastWasDash = false;
    } else if (out.length > 0 && !lastWasDash) {
      out += "-";
      lastWasDash = true;
    }
  }
  if (out.endsWith("-")) out = out.slice(0, -1);
  return out;
}

function escapeForRegex(input: string): string {
  let out = "";
  for (const ch of input) {
    if (".*+?^${}()|[]\\".indexOf(ch) >= 0) out += "\\";
    out += ch;
  }
  return out;
}

interface ResolvedOrg {
  id: string;
  name: string;
}

@Injectable()
export class OrgsService implements OnModuleInit {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateFreeformOrgs();
  }

  async findOrCreate(name: string, createdBy: string): Promise<ResolvedOrg | null> {
    const trimmed = name.trim();
    if (trimmed === "") return null;
    const slug = slugify(trimmed);
    if (slug === "") return null;
    const existing = await this.orgModel.findOne({ slug }).exec();
    if (existing) return { id: String(existing._id), name: existing.name };
    const created = await this.orgModel.create({
      name: trimmed,
      slug,
      description: "",
      createdBy,
    });
    return { id: String(created._id), name: created.name };
  }

  async searchOrgs(query: string): Promise<OrgSearchResponse> {
    const q = query.trim();
    if (q.length < 2) return { orgs: [] };
    const re = new RegExp(escapeForRegex(q), "i");
    const docs = await this.orgModel
      .find({ $or: [{ name: re }, { slug: re }] })
      .sort({ name: 1 })
      .limit(20)
      .lean();
    const ids = docs.map((d) => String(d._id));
    const counts = await this.memberCounts(ids);
    const hits: OrgSearchHit[] = docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      memberCount: counts.get(String(d._id)) ?? 0,
    }));
    return { orgs: hits };
  }

  async getBySlug(slug: string): Promise<OrgSummary> {
    const doc = await this.orgModel.findOne({ slug }).exec();
    if (!doc) throw new NotFoundException("Organization not found");
    const orgId = String(doc._id);
    const [memberCount, teamCount] = await Promise.all([
      this.userModel.countDocuments({ organizationId: orgId }).exec(),
      this.teamModel.countDocuments({ organizationId: orgId }).exec(),
    ]);
    return {
      id: orgId,
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      memberCount,
      teamCount,
    };
  }

  private async memberCounts(orgIds: string[]): Promise<Map<string, number>> {
    if (orgIds.length === 0) return new Map();
    const rows = await this.userModel.aggregate([
      { $match: { organizationId: { $in: orgIds } } },
      { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    ]);
    const out = new Map<string, number>();
    for (const r of rows) out.set(String(r._id), r.count as number);
    return out;
  }

  private async migrateFreeformOrgs(): Promise<void> {
    const users = await this.userModel
      .find({ organization: { $ne: "" }, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] })
      .lean();
    const teams = await this.teamModel
      .find({ organization: { $ne: "" }, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] })
      .lean();

    if (users.length === 0 && teams.length === 0) return;

    let migrated = 0;
    for (const u of users) {
      const resolved = await this.findOrCreate(u.organization, u.username);
      if (resolved === null) continue;
      await this.userModel.updateOne({ _id: u._id }, { $set: { organizationId: resolved.id, organization: resolved.name } });
      migrated += 1;
    }
    for (const t of teams) {
      const resolved = await this.findOrCreate(t.organization, t.adminUsername);
      if (resolved === null) continue;
      await this.teamModel.updateOne({ _id: t._id }, { $set: { organizationId: resolved.id, organization: resolved.name } });
      migrated += 1;
    }
    if (migrated > 0) {
      this.logger.log(`Migrated ${migrated} freeform organization values into the organizations collection`);
    }
  }
}

export { slugify };
