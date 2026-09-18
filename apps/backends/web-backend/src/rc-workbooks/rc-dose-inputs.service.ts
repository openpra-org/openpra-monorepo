import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcDoseInputs, RcDosePathway } from "interfaces-mef-types/rc/dose-inputs";
import { RcDoseInputsSchema, RcDoseSettingsSchema } from "interfaces-mef-types/zod/rc/dose-inputs";
import { decodeRcDoseText, doseLines, parseRcDoseCoefficients, parseRcExposure } from "interfaces-shared-types/rc-workbooks/dose-input-parser";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";
const revision = z.number().int().nonnegative();
const reason = (e: unknown) => e instanceof z.ZodError ? e.issues.slice(0, 5).map(i => i.message).join("; ") : e instanceof Error ? e.message : "Invalid dose input";
interface Actor { username: string }
@Injectable()
export class RcDoseInputsService {
  private readonly logger = new Logger(RcDoseInputsService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>, private readonly projects: ProjectsService,
    private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}
  private async load(id: string, actor: Actor, baseRevision?: number) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor), mef = doc.mef as RadiologicalConsequenceAnalysis, inputs = mef.dosimetry.doseInputs;
    if (baseRevision !== undefined) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can edit dose inputs");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Dose inputs are locked during review and approval");
      if ((inputs?.revision ?? 0) !== baseRevision) throw new ConflictException("Dose inputs changed. Reload before saving");
    }
    return { doc, mef, inputs };
  }
  private source(loaded: Awaited<ReturnType<RcDoseInputsService["load"]>>, categoryId: string, sourceRevision: number) {
    const source = loaded.mef.releaseCategoryToConsequence.releaseCategoryInputs.find(c => c.releaseCategory === categoryId)?.sourceTerm;
    if (!source) throw new BadRequestException("Import or save this category's Step 01 source inventory first");
    if (source.revision !== sourceRevision) throw new ConflictException("The Step 01 source changed. Review the dose settings again");
    return source;
  }
  private initial(inputs?: RcDoseInputs): RcDoseInputs { return inputs ? { ...inputs, categories: [...inputs.categories], libraries: [...inputs.libraries] } : { revision: 1, categories: [], libraries: [] }; }
  private async persist(loaded: Awaited<ReturnType<RcDoseInputsService["load"]>>, inputs: RcDoseInputs) {
    const { doc, mef } = loaded;
    let next: RcDoseInputs;
    try { next = RcDoseInputsSchema.parse({ ...inputs, revision: doc.__v + 1 }); } catch (e) { throw new BadRequestException(reason(e)); }
    const result = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef, dosimetry: { ...mef.dosimetry, doseInputs: next } })) }, $inc: { __v: 1 } }).exec();
    if (!result.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving dose inputs");
    return next;
  }
  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, sourceRevision: revision, categoryId: z.string().min(1), settings: RcDoseSettingsSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(reason(parsed.error));
    const p = parsed.data, loaded = await this.load(id, actor, p.baseRevision), source = this.source(loaded, p.categoryId, p.sourceRevision), next = this.initial(loaded.inputs), old = next.categories.find(c => c.categoryId === p.categoryId);
    if (p.settings.basis === "imported" && p.settings.integrationSeconds !== old?.exposure?.data.integrationSeconds) throw new BadRequestException("The imported duration must match the retained exposure file");
    next.categories = [...next.categories.filter(c => c.categoryId !== p.categoryId), { ...old, categoryId: p.categoryId, settings: p.settings, savedForSourceRevision: source.revision }];
    return this.persist(loaded, next);
  }
  async importFile(id: string, kind: "exposure" | RcDosePathway, body: unknown, upload: { buffer: Buffer; originalname: string }, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, sourceRevision: revision.optional(), categoryId: z.string().min(1).optional() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(reason(parsed.error));
    const p = parsed.data, loaded = await this.load(id, actor, p.baseRevision), next = this.initial(loaded.inputs);
    if (!upload.buffer.length || upload.buffer.length > 15 * 1024 * 1024) throw new BadRequestException("Choose a nonempty text file up to 15 MB");
    if (kind === "exposure") {
      if (p.sourceRevision === undefined || !p.categoryId) throw new BadRequestException("Provide a source category and revision for exposure settings");
      this.source(loaded, p.categoryId, p.sourceRevision);
    }
    let exposure, coefficients;
    try { const raw = decodeRcDoseText(upload.buffer); if (kind === "exposure") exposure = parseRcExposure(raw); else coefficients = parseRcDoseCoefficients(raw, kind); }
    catch (e) { throw new BadRequestException(reason(e)); }
    const sha256 = createHash("sha256").update(upload.buffer).digest("hex");
    if (kind !== "exposure" && next.libraries.some(l => l.kind === kind && l.file.sha256 === sha256)) return loaded.inputs!;
    const filename = upload.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "dose-input.txt";
    const original = await this.documents.upload(id, { buffer: upload.buffer, originalName: filename, mimeType: "text/plain", size: upload.buffer.length }, actor, false, false, false, false, true);
    const file = { documentId: original.documentId, filename, sha256, uploadedAt: original.uploadedAt, size: upload.buffer.length };
    try {
      if (exposure) next.categories = [...next.categories.filter(c => c.categoryId !== p.categoryId), { categoryId: p.categoryId!, settings: { integrationSeconds: exposure.integrationSeconds, basis: "imported" }, exposure: { file, data: exposure } }];
      else {
        next.libraries = [...next.libraries.filter(l => l.kind !== kind), { kind: kind as RcDosePathway, file, nuclides: [...new Set(coefficients!.map(r => r.name))], recordCount: coefficients!.length }];
        next.categories = next.categories.map(c => ({ ...c, savedForSourceRevision: undefined }));
      }
      return await this.persist(loaded, next);
    } catch (e) {
      try { await this.documents.discardUnlinkedInputOriginal(id, file.documentId); } catch { this.logger.warn(`Could not clean up unsuccessful dose import ${file.documentId}`); }
      throw e;
    }
  }
  async original(id: string, documentId: string, offset: number, actor: Actor) {
    await this.load(id, actor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException("Use a nonnegative line offset");
    const bytes = await this.documents.readDoseInput(id, documentId, actor), lines = doseLines(decodeRcDoseText(bytes));
    return { text: lines.slice(offset, offset + 6).join("\n").replace(/\xff/g, ""), offset, total: lines.length };
  }
  async records(id: string, documentId: string, nuclide: string, actor: Actor) {
    const loaded = await this.load(id, actor), file = loaded.inputs?.libraries.find(l => l.file.documentId === documentId);
    if (!file) throw new NotFoundException("Coefficient file is not in the active library");
    if (!nuclide || nuclide.length > 20) throw new BadRequestException("Provide a radionuclide name");
    const raw = await this.documents.readDoseInput(id, documentId, actor);
    return parseRcDoseCoefficients(decodeRcDoseText(raw), file.kind).filter(r => r.name.toLowerCase() === nuclide.toLowerCase());
  }
}
