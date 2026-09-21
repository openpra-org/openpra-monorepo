import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcLinkedDeposition, RcTransportCategory, RcTransportFile, RcTransportInputs } from "interfaces-mef-types/rc/transport";
import { RcTransportInputsSchema, RcTransportSettingsSchema } from "interfaces-mef-types/zod/rc/transport";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcDecay, parseRcDeposition, parseRcDispersionReference } from "interfaces-shared-types/rc-workbooks/transport-parser";
import { depositionMatchesSource, effectiveDepositionVelocity, nobleGasGroup } from "interfaces-shared-types/rc-workbooks/transport";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

interface Actor { username: string }
interface Upload { buffer: Buffer; originalname: string }
const revision = z.number().int().nonnegative();
const reason = (e: unknown) => e instanceof z.ZodError ? e.issues.slice(0, 5).map(i => i.message).join("; ") : e instanceof Error ? e.message : "Invalid transport input";
@Injectable()
export class RcTransportService {
  private readonly logger = new Logger(RcTransportService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService, private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}
  private async load(id: string, actor: Actor, baseRevision?: unknown) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor), mef = doc.mef as RadiologicalConsequenceAnalysis;
    const inputs = mef.atmosphericTransportAndDispersion.transportInputs;
    if (baseRevision !== undefined) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can edit transport inputs");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Transport inputs are locked during review and approval");
      if (!revision.safeParse(baseRevision).success) throw new BadRequestException("A transport-input revision is required");
      if ((inputs?.revision ?? 0) !== baseRevision) throw new ConflictException("Transport inputs changed. Reload before saving");
    }
    return { doc, mef, inputs };
  }
  private source(loaded: Awaited<ReturnType<RcTransportService["load"]>>, categoryId: string, sourceRevision?: number) {
    const source = loaded.mef.releaseCategoryToConsequence.releaseCategoryInputs.find(c => c.releaseCategory === categoryId)?.sourceTerm;
    if (!source) throw new BadRequestException("Import or save the source inventory for this category in Step 01");
    if (sourceRevision !== undefined && source.revision !== sourceRevision) throw new ConflictException("The Step 01 source changed. Review the transport settings again");
    return source;
  }
  private async persist(loaded: Awaited<ReturnType<RcTransportService["load"]>>, inputs: RcTransportInputs) {
    const { doc, mef } = loaded;
    let next: RcTransportInputs;
    try { next = RcTransportInputsSchema.parse({ ...inputs, revision: doc.__v + 1 }); } catch (e) { throw new BadRequestException(reason(e)); }
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef,
      atmosphericTransportAndDispersion: { ...mef.atmosphericTransportAndDispersion, transportInputs: next },
    })) }, $inc: { __v: 1 } }).exec();
    if (!saved.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving transport inputs");
    return next;
  }
  private initial(inputs?: RcTransportInputs): RcTransportInputs { return inputs ? { ...inputs, categories: [...inputs.categories], decayFiles: [...inputs.decayFiles] } : { revision: 1, categories: [], decayFiles: [] }; }
  private setCategory(inputs: RcTransportInputs, category: RcTransportCategory) {
    inputs.categories = [...inputs.categories.filter(c => c.categoryId !== category.categoryId), category];
  }
  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, sourceRevision: revision, categoryId: z.string().min(1), settings: RcTransportSettingsSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(reason(parsed.error));
    const p = parsed.data, loaded = await this.load(id, actor, p.baseRevision), source = this.source(loaded, p.categoryId, p.sourceRevision), settings = p.settings;
    if (settings.groupVelocities.length !== source.values.groups.length || source.values.groups.some(g => !settings.groupVelocities.some(v => v.groupId === g.id && v.name === g.name)))
      throw new BadRequestException("Group velocities must match the current Step 01 chemical groups");
    const old = loaded.inputs?.categories.find(c => c.categoryId === p.categoryId);
    let deposition = old?.deposition?.data;
    if (!deposition && source.originalFile) {
      try { deposition = parseRcDeposition(decodeRcText(await this.documents.readSourceInput(id, source.originalFile.documentId, actor))); } catch { /* An analyst value remains valid when the source file has no deposition cards. */ }
    }
    for (const v of settings.groupVelocities) {
      const noble = nobleGasGroup(source.values, v.groupId);
      const derived = effectiveDepositionVelocity(deposition, v.groupId);
      if (noble && (v.velocity !== 0 || v.basis !== "noble_gas") || !noble && v.basis === "noble_gas" || v.basis === "openrc_default"
        || v.basis === "source_file" && (derived === undefined || Math.abs(v.velocity - derived) > Math.max(1e-12, Math.abs(derived) * 1e-9)))
        throw new BadRequestException("Check the deposition velocity and its stated basis");
    }
    const next = this.initial(loaded.inputs), previous = next.categories.find(c => c.categoryId === p.categoryId);
    if (previous?.deposition && !depositionMatchesSource(previous.deposition.data, source.values)) throw new BadRequestException("Replace the deposition file or use Step 01 data before saving settings for the changed source groups");
    this.setCategory(next, { ...previous, categoryId: p.categoryId, settings, savedForSourceRevision: source.revision });
    return this.persist(loaded, next);
  }
  async importFiles(id: string, kind: "deposition" | "dispersion" | "decay", body: unknown, files: Upload[], actor: Actor) {
    const parsed = z.object({ baseRevision: revision, categoryId: z.string().min(1).optional(), sourceRevision: revision.optional() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(reason(parsed.error));
    const p = parsed.data, loaded = await this.load(id, actor, p.baseRevision), next = this.initial(loaded.inputs);
    if (!files.length || files.length > 8 || kind !== "decay" && files.length !== 1 || files.some(f => !f.buffer.length || f.buffer.length > 12 * 1024 * 1024) || files.reduce((n, f) => n + f.buffer.length, 0) > 24 * 1024 * 1024)
      throw new BadRequestException("Choose up to eight nonempty text files, 12 MB each and 24 MB total");
    const source = kind === "deposition" ? this.source(loaded, p.categoryId ?? "", p.sourceRevision) : undefined;
    if (kind === "deposition" && p.sourceRevision === undefined) throw new BadRequestException("A source revision is required for deposition imports");
    // Parse every file before storing any part of a batch.
    let pending;
    try { pending = files.map(f => {
      const raw = decodeRcText(f.buffer), data = kind === "deposition" ? parseRcDeposition(raw) : undefined;
      if (data && !depositionMatchesSource(data, source!.values)) throw new Error("Deposition groups must match the selected Step 01 source");
      return { f, data, dispersion: kind === "dispersion" ? parseRcDispersionReference(raw) : undefined,
        parents: kind === "decay" ? parseRcDecay(raw).map(d => d.parent) : undefined, sha256: createHash("sha256").update(f.buffer).digest("hex") };
    }); } catch (e) { throw new BadRequestException(reason(e)); }
    const created: RcTransportFile[] = [];
    try {
      for (const item of pending) {
        if (kind === "decay" && next.decayFiles.some(d => d.file.sha256 === item.sha256)) continue;
        const filename = item.f.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "transport-input.txt";
        const original = await this.documents.upload(id, { buffer: item.f.buffer, originalName: filename, mimeType: "text/plain", size: item.f.buffer.length }, actor, false, false, false, true);
        const file = { documentId: original.documentId, filename, sha256: item.sha256, uploadedAt: original.uploadedAt, size: item.f.buffer.length }; created.push(file);
        if (item.data) {
          const old = next.categories.find(c => c.categoryId === p.categoryId);
          this.setCategory(next, { ...old, categoryId: p.categoryId!, savedForSourceRevision: undefined, deposition: { file, data: item.data } });
        } else if (item.dispersion) next.dispersionReference = { file, data: item.dispersion };
        else if (item.parents) next.decayFiles.push({ file, parents: item.parents });
      }
      return created.length ? await this.persist(loaded, next) : loaded.inputs!;
    } catch (e) {
      for (const f of created) try { await this.documents.discardUnlinkedInputOriginal(id, f.documentId); } catch { this.logger.warn(`Could not clean up unsuccessful transport import ${f.documentId}`); }
      throw e;
    }
  }
  async linkedSource(id: string, categoryId: string, actor: Actor): Promise<RcLinkedDeposition> {
    const loaded = await this.load(id, actor), source = this.source(loaded, categoryId);
    if (!source.originalFile) return { sourceRevision: source.revision, issue: "No original source file. Import deposition data to inspect particle-size bins." };
    const raw = await this.documents.readSourceInput(id, source.originalFile.documentId, actor);
    try {
      const data = parseRcDeposition(decodeRcText(raw));
      if (!depositionMatchesSource(data, source.values)) throw new Error("The original file's deposition groups differ from the edited source inventory");
      return { sourceRevision: source.revision, file: source.originalFile, data };
    } catch (e) { return { sourceRevision: source.revision, file: source.originalFile, issue: reason(e) }; }
  }
  async remove(id: string, body: unknown, actor: Actor) {
    const p = z.object({ baseRevision: revision, kind: z.enum(["decay", "deposition"]), documentId: z.string().uuid().optional(), categoryId: z.string().optional() }).strict().safeParse(body);
    if (!p.success) throw new BadRequestException(reason(p.error));
    const loaded = await this.load(id, actor, p.data.baseRevision), next = this.initial(loaded.inputs);
    if (p.data.kind === "decay") {
      if (!next.decayFiles.some(f => f.file.documentId === p.data.documentId)) throw new NotFoundException("Decay file is not in the active library");
      next.decayFiles = next.decayFiles.filter(f => f.file.documentId !== p.data.documentId);
    } else {
      const category = next.categories.find(c => c.categoryId === p.data.categoryId);
      if (!category?.deposition) throw new NotFoundException("No replacement deposition file is selected");
      this.setCategory(next, { ...category, deposition: undefined, savedForSourceRevision: undefined });
    }
    // Originals remain retained; removing a library entry only unlinks its active use.
    return this.persist(loaded, next);
  }
  async original(id: string, documentId: string, actor: Actor) {
    const loaded = await this.load(id, actor), sourceFile = loaded.mef.releaseCategoryToConsequence.releaseCategoryInputs.some(c => c.sourceTerm?.originalFile?.documentId === documentId);
    return { text: decodeRcText(await (sourceFile ? this.documents.readSourceInput(id, documentId, actor) : this.documents.readTransportInput(id, documentId, actor))) };
  }
  async decayDetail(id: string, documentId: string, index: number, offset: number, actor: Actor) {
    const loaded = await this.load(id, actor);
    if (!loaded.inputs?.decayFiles.some(f => f.file.documentId === documentId)) throw new NotFoundException("Decay file is not in the active library");
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(offset) || offset < 0) throw new BadRequestException("Use nonnegative parent and level indices");
    const raw = await this.documents.readTransportInput(id, documentId, actor), detail = parseRcDecay(decodeRcText(raw))[index];
    if (!detail) throw new NotFoundException("Parent record not found");
    return { ...detail, offset, levels: detail.levels.slice(offset, offset + 6) };
  }
}
