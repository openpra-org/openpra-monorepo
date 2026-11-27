import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { z } from "zod";
import { User, type UserDocument } from "../users/user.schema";
import { Workbook, type WorkbookDocument, type WorkbookRecentChange } from "./workbook.schema";
import { WorkbookElementRegistry } from "./workbook-element-registry";
import { WorkbookLiveService } from "./workbook-live.service";

type WorkbookChangePath = (string | number)[];

const RECENT_CHANGE_LIMIT = 200;
const WorkbookChangePathSchema = z.array(z.union([z.string(), z.number()]));

function decodeChangePath(text: string): WorkbookChangePath {
  try {
    const parsed = WorkbookChangePathSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function startsWith(path: WorkbookChangePath, prefix: WorkbookChangePath): boolean {
  if (prefix.length > path.length) return false;
  return prefix.every((segment, index) => segment === path[index]);
}

function changePathsOverlap(left: WorkbookChangePath, right: WorkbookChangePath): boolean {
  return startsWith(left, right) || startsWith(right, left);
}

function changeTouches(change: WorkbookRecentChange, paths: WorkbookChangePath[]): boolean {
  const changed: WorkbookChangePath[] = change.paths.length === 0 ? [[]] : change.paths.map(decodeChangePath);
  return changed.some((done) => paths.some((path) => changePathsOverlap(done, path)));
}

@Injectable()
export class WorkbookChangesService {
  private readonly logger = new Logger(WorkbookChangesService.name);

  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly live: WorkbookLiveService,
  ) {}

  async currentSeq(workbookId: string): Promise<number | null> {
    if (!isValidObjectId(workbookId)) return null;
    const doc = await this.workbookModel.findById(workbookId).select({ changeSeq: 1 }).lean().exec();
    if (doc === null) return null;
    return doc.changeSeq ?? 0;
  }

  async admit(workbookId: string, paths: WorkbookChangePath[] | null, seen: number | null, clientId: string | null): Promise<number | null> {
    if (paths === null || seen === null || !isValidObjectId(workbookId)) return null;
    const doc = await this.workbookModel.findById(workbookId).select({ changeSeq: 1, recentChanges: 1, elementCode: 1 }).lean().exec();
    if (doc === null) return null;
    const current = doc.changeSeq ?? 0;
    if (current <= seen) return null;
    const recent = doc.recentChanges ?? [];
    const unseen = current - seen;
    if (unseen > recent.length) throw new ConflictException("This workbook changed while it was open. Reload it to see the latest version.");
    const others = recent.slice(recent.length - unseen).filter((change) => change.clientId === null || change.clientId !== clientId);
    const clash = others.find((change) => changeTouches(change, paths));
    if (clash !== undefined) {
      throw new ConflictException(`${await this.nameOf(clash.actor)} changed the same field at the same time. Your change was not saved.`);
    }
    if (others.length === 0) return null;
    const stored = await this.registry.tryGet(doc.elementCode)?.load(workbookId);
    return stored?.revision ?? null;
  }

  async record(workbookId: string, paths: WorkbookChangePath[], actor: string, clientId: string | null): Promise<void> {
    if (!isValidObjectId(workbookId)) return;
    const change: WorkbookRecentChange = { paths: paths.map((path) => JSON.stringify(path)), actor, clientId, at: new Date() };
    try {
      const updated = await this.workbookModel
        .findByIdAndUpdate(
          workbookId,
          { $inc: { changeSeq: 1 }, $push: { recentChanges: { $each: [change], $slice: -RECENT_CHANGE_LIMIT } } },
          { new: true, timestamps: false },
        )
        .select({ changeSeq: 1 })
        .lean()
        .exec();
      if (updated === null) return;
      this.live.publish({ workbookId, seq: updated.changeSeq ?? 0, actor, clientId, at: change.at.toISOString() });
    } catch (error) {
      this.logger.warn(`Could not record a change of workbook ${workbookId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async announce(workbookId: string, actor: string, clientId: string | null): Promise<void> {
    const seq = await this.currentSeq(workbookId);
    if (seq === null) return;
    this.live.publish({ workbookId, seq, actor, clientId, at: new Date().toISOString() });
  }

  private async nameOf(username: string): Promise<string> {
    const user = await this.userModel.findOne({ username }).select({ fullName: 1 }).lean().exec();
    return user?.fullName ?? username;
  }
}

export { changePathsOverlap, decodeChangePath, type WorkbookChangePath };
