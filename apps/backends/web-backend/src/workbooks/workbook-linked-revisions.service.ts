import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "crypto";
import { Model, isValidObjectId } from "mongoose";
import { linkedRevisionsOutOfDate, type WorkbookLinkedRevision, type WorkbookLinkedRevisionStatus, type WorkbookSignedAgainst } from "interfaces-shared-types/workbooks";
import { ProjectsService } from "../projects/projects.service";
import { Workbook, type WorkbookDocument } from "./workbook.schema";
import { WorkbookElementRegistry } from "./workbook-element-registry";

type JsonField = string | number | boolean | null | object;

interface LinkedShape {
  workflowState?: string;
  linkedWorkbooks?: Record<string, string | undefined>;
}

const WORKFLOW_KEYS: ReadonlySet<string> = new Set(["workflowState", "workflowHistory", "internalReviewComments"]);

const SIGNED_STATES: ReadonlySet<string> = new Set(["INTERNAL_TECHNICAL_REVIEW", "INTERNAL_APPROVAL", "FINAL"]);

const EXAMPLE_PREFIX = "example-";

function contentFingerprint(mef: Record<string, JsonField>): string {
  const content = Object.fromEntries(Object.entries(mef).filter(([key]) => !WORKFLOW_KEYS.has(key)));
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

@Injectable()
export class WorkbookLinkedRevisionsService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    private readonly registry: WorkbookElementRegistry,
    private readonly projectsService: ProjectsService,
  ) {}

  private async revisionOf(code: string, workbookId: string): Promise<WorkbookLinkedRevision> {
    if (workbookId.startsWith(EXAMPLE_PREFIX)) return { code, workbookId, name: `${code} example`, revision: 1, fingerprint: workbookId };
    const wb = isValidObjectId(workbookId) ? await this.workbookModel.findById(workbookId).exec() : null;
    const name = wb?.name ?? `${code} workbook`;
    const adapter = this.registry.tryGet(wb?.elementCode ?? code);
    const loaded = adapter === undefined ? null : await adapter.load(workbookId).catch(() => null);
    if (loaded === null) return { code, workbookId, name, fingerprint: "unavailable" };
    return {
      code,
      workbookId,
      name,
      ...(loaded.revision === undefined ? {} : { revision: loaded.revision }),
      fingerprint: contentFingerprint(loaded.mef as Record<string, JsonField>),
    };
  }

  async current(workbookId: string): Promise<WorkbookLinkedRevision[]> {
    const wb = isValidObjectId(workbookId) ? await this.workbookModel.findById(workbookId).exec() : null;
    if (wb === null) return [];
    const adapter = this.registry.tryGet(wb.elementCode);
    const loaded = adapter === undefined ? null : await adapter.load(workbookId);
    if (adapter === undefined || loaded === null) return [];
    const links = new Map<string, string>();
    for (const [code, id] of Object.entries((loaded.mef as LinkedShape).linkedWorkbooks ?? {})) {
      if (typeof id === "string" && id.length > 0) links.set(code, id);
    }
    for (const [code, id] of Object.entries((await adapter.linkedWorkbookIds?.(workbookId)) ?? {})) {
      if (id.length > 0) links.set(code, id);
    }
    const entries = await Promise.all([...links.entries()].map(([code, id]) => this.revisionOf(code, id)));
    return entries.sort((left, right) => left.code.localeCompare(right.code));
  }

  async record(workbookId: string, event: WorkbookSignedAgainst["event"]): Promise<WorkbookLinkedRevision[]> {
    const links = await this.current(workbookId);
    const signedAgainst: WorkbookSignedAgainst = { recordedAt: new Date().toISOString(), event, links };
    if (isValidObjectId(workbookId)) await this.workbookModel.updateOne({ _id: workbookId }, { $set: { signedAgainst } }, { timestamps: false }).exec();
    return links;
  }

  async clear(workbookId: string): Promise<void> {
    if (isValidObjectId(workbookId)) await this.workbookModel.updateOne({ _id: workbookId }, { $set: { signedAgainst: null } }, { timestamps: false }).exec();
  }

  async status(workbookId: string, acting: { username: string }): Promise<WorkbookLinkedRevisionStatus> {
    const wb = isValidObjectId(workbookId) ? await this.workbookModel.findById(workbookId).exec() : null;
    if (wb === null) throw new NotFoundException("Workbook not found");
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const loaded = await this.registry.tryGet(wb.elementCode)?.load(workbookId);
    const state = loaded === undefined || loaded === null ? undefined : (loaded.mef as LinkedShape).workflowState;
    const current = await this.current(workbookId);
    const signedAgainst = state !== undefined && SIGNED_STATES.has(state) ? wb.signedAgainst ?? null : null;
    return { signedAgainst, current, outOfDate: linkedRevisionsOutOfDate(signedAgainst, current) };
  }
}
