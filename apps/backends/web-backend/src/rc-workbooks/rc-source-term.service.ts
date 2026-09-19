import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { ReleaseCategoryInputs, RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSourceTerm, RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { decodeRcText, parseRcSource } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { withSourceTermSummary } from "interfaces-shared-types/rc-workbooks/source-term-summary";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

const revisionSchema = z.number().int().nonnegative();
interface Actor { username: string }

@Injectable()
export class RcSourceTermService {
  private readonly logger = new Logger(RcSourceTermService.name);
  constructor(
    @InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService,
    private readonly roles: WorkbookRolesService,
    private readonly documents: RcDocumentsService,
  ) {}

  private async load(workbookId: string, categoryId: string, baseRevision: unknown, actor: Actor) {
    if (!revisionSchema.safeParse(baseRevision).success) throw new BadRequestException("A source-term revision is required");
    const doc = await this.workbooks.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor);
    const roles = await this.roles.resolveEffectiveRoles(workbookId, actor.username);
    if (access.role === "viewer" || !roles.some((role) => role === "preparer" || role === "co_preparer"))
      throw new ForbiddenException("Only preparers can edit source terms");
    const mef = doc.mef as RadiologicalConsequenceAnalysis;
    if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT"))
      throw new ForbiddenException("Source terms are locked during review and approval");
    const category = mef.releaseCategoryToConsequence.releaseCategoryInputs.find((c) => c.releaseCategory === categoryId);
    if (!category) throw new NotFoundException("Save the release category before importing its source term");
    if ((category.sourceTerm?.revision ?? 0) !== baseRevision)
      throw new ConflictException("This source term changed. Reload the workbook before saving");
    return { doc, mef, category };
  }

  private async persist(loaded: Awaited<ReturnType<RcSourceTermService["load"]>>, sourceTerm: RcSourceTerm): Promise<ReleaseCategoryInputs> {
    const { doc, mef, category } = loaded;
    const next = withSourceTermSummary({ ...category, sourceTerm });
    const nextMef = { ...mef, releaseCategoryToConsequence: { ...mef.releaseCategoryToConsequence,
      releaseCategoryAndSourceTermReviewed: false,
      releaseCategoryInputs: mef.releaseCategoryToConsequence.releaseCategoryInputs.map((c) => c.releaseCategory === category.releaseCategory ? next : c),
    } };
    // Mixed Mongo fields otherwise turn undefined optional quantities into null.
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, {
      $set: { mef: JSON.parse(JSON.stringify(nextMef)) }, $inc: { __v: 1 },
    }).exec();
    if (!saved.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving this source term");
    return next;
  }

  async importFile(workbookId: string, categoryId: string, baseRevision: unknown,
    file: { buffer: Buffer; originalname: string }, actor: Actor): Promise<ReleaseCategoryInputs> {
    const loaded = await this.load(workbookId, categoryId, baseRevision, actor);
    if (!file.buffer.length || file.buffer.length > 2 * 1024 * 1024) throw new BadRequestException("Choose a nonempty source-term text file up to 2 MB");
    let values: RcSourceTermValues;
    try { values = parseRcSource(decodeRcText(file.buffer)); }
    catch (error) {
      const reason = error instanceof z.ZodError ? error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : error instanceof Error ? error.message : "Invalid source-term file";
      throw new BadRequestException(reason);
    }
    const filename = file.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "source-term.inp";
    const original = await this.documents.upload(workbookId, {
      buffer: file.buffer, originalName: filename, size: file.buffer.length, mimeType: "text/plain",
    }, actor, true);
    try {
      return await this.persist(loaded, {
        revision: loaded.doc.__v + 1, values,
        originalFile: { documentId: original.documentId, filename, size: file.buffer.length,
          uploadedAt: original.uploadedAt, sha256: createHash("sha256").update(file.buffer).digest("hex") },
      });
    } catch (error) {
      try { await this.documents.discardUnlinkedSourceOriginal(workbookId, original.documentId); }
      catch { this.logger.warn(`Could not clean up unsuccessful source import ${original.documentId}`); }
      throw error;
    }
  }

  async save(workbookId: string, categoryId: string, body: unknown, actor: Actor): Promise<ReleaseCategoryInputs> {
    const parsed = z.object({ baseRevision: revisionSchema, values: RcSourceTermValuesSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const loaded = await this.load(workbookId, categoryId, parsed.data.baseRevision, actor);
    return this.persist(loaded, { ...loaded.category.sourceTerm, revision: loaded.doc.__v + 1, values: parsed.data.values });
  }
}
