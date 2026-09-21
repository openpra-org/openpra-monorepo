import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "crypto";
import { Model } from "mongoose";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import type { RcResponseCalculationInput } from "interfaces-mef-types/rc/early-response-calculation";
import { RcEarlyResponseModelSchema } from "interfaces-mef-types/zod/rc/early-response";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseEarlyResponseRecords } from "interfaces-shared-types/rc-workbooks/early-response-parser";
import { calculateEarlyResponse } from "interfaces-shared-types/rc-workbooks/early-response-calculation";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

interface Actor { username: string }
@Injectable()
export class RcEarlyResponseService {
  private readonly logger = new Logger(RcEarlyResponseService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService, private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}

  private async load(id: string, baseRevision: unknown, actor: Actor) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor);
    const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
    const mef = doc.mef as RadiologicalConsequenceAnalysis;
    if (access.role === "viewer" || !roles.some(role => role === "preparer" || role === "co_preparer")) throw new ForbiddenException("Only preparers can edit response inputs");
    if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Response inputs are locked during review");
    if (!z.number().int().nonnegative().safeParse(baseRevision).success) throw new BadRequestException("A response revision is required");
    const current = mef.protectiveActionParameters.earlyResponseModel;
    if ((current?.revision ?? 0) !== baseRevision) throw new ConflictException("Response inputs changed. Reload before saving");
    return { doc, mef, current };
  }

  private async persist(loaded: Awaited<ReturnType<RcEarlyResponseService["load"]>>, input: RcEarlyResponseModel) {
    const { doc, mef } = loaded;
    const next = { ...input, revision: doc.__v + 1 };
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef,
      protectiveActionParameters: { ...mef.protectiveActionParameters, earlyResponseModel: next },
    })) }, $inc: { __v: 1 } }).exec();
    if (!saved.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving response inputs");
    return next;
  }

  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: z.number().int().nonnegative(), model: RcEarlyResponseModelSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    const loaded = await this.load(id, parsed.data.baseRevision, actor);
    if (parsed.data.model.originalFile && JSON.stringify(parsed.data.model.originalFile) !== JSON.stringify(loaded.current?.originalFile))
      throw new BadRequestException("Original-file provenance cannot be edited");
    if (parsed.data.model.unassignedRecords && JSON.stringify(parsed.data.model.unassignedRecords) !== JSON.stringify(loaded.current?.unassignedRecords))
      throw new BadRequestException("Imported records cannot be edited");
    return this.persist(loaded, { ...parsed.data.model, originalFile: loaded.current?.originalFile, unassignedRecords: loaded.current?.unassignedRecords });
  }

  async importFile(id: string, baseRevision: number, file: { buffer: Buffer; originalname: string }, actor: Actor) {
    const loaded = await this.load(id, baseRevision, actor);
    if (!file.buffer.length || file.buffer.length > 5 * 1024 * 1024) throw new BadRequestException("Choose a nonempty text file up to 5 MB");
    let input: RcEarlyResponseModel;
    try {
      const text = decodeRcText(file.buffer);
      input = /\.json$/i.test(file.originalname)
        ? RcEarlyResponseModelSchema.parse({ ...JSON.parse(text), originalFile: undefined, revision: 1 })
        : parseEarlyResponseRecords(text, loaded.current);
    }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid response file"); }
    const filename = file.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "response.inp";
    const original = await this.documents.upload(id, { buffer: file.buffer, originalName: filename, size: file.buffer.length, mimeType: "text/plain" }, actor,
      false, false, false, false, false, false, true);
    input.originalFile = { documentId: original.documentId, filename, size: file.buffer.length, uploadedAt: original.uploadedAt,
      sha256: createHash("sha256").update(file.buffer).digest("hex") };
    try { return await this.persist(loaded, input); }
    catch (error) {
      try { await this.documents.discardUnlinkedInputOriginal(id, original.documentId); }
      catch { this.logger.warn(`Could not clean up unsuccessful response import ${original.documentId}`); }
      throw error;
    }
  }

  async original(id: string, documentId: string, actor: Actor) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    if ((doc.mef as RadiologicalConsequenceAnalysis).protectiveActionParameters.earlyResponseModel?.originalFile?.documentId !== documentId)
      throw new NotFoundException("Response file not linked to this workbook");
    return { text: decodeRcText(await this.documents.readResponseInput(id, documentId, actor)) };
  }

  async calculate(id: string, categoryId: string, file: { buffer: Buffer; originalname: string }, actor: Actor) {
    if (!categoryId || !file.buffer.length || file.buffer.length > 15 * 1024 * 1024 || !/\.json$/i.test(file.originalname))
      throw new BadRequestException("Choose a nonempty .json response calculation file up to 15 MB and a release category");
    let body: unknown;
    try { body = JSON.parse(decodeRcText(file.buffer)); }
    catch { throw new BadRequestException("The response calculation file must be valid JSON"); }
    const rate = z.object({ cellIndex: z.number().int().nonnegative(), startSeconds: z.number().finite().nonnegative(), endSeconds: z.number().finite().positive(),
      organ: z.string().min(1), cloudshineSvPerSecond: z.number().finite().nonnegative(), inhalationSvPerSecond: z.number().finite().nonnegative(),
      groundshineSvPerSecond: z.number().finite().nonnegative(), skinSvPerSecond: z.number().finite().nonnegative(), iodineInhalationSvPerSecond: z.number().finite().nonnegative().optional() }).strict();
    const parsed = z.object({ originCellIndex: z.number().int().nonnegative(), targetOrgan: z.string().min(1).optional(),
      plumeArrivalSecondsByCell: z.array(z.number().finite().nonnegative()).optional(),
      plumeSector: z.number().int().nonnegative().optional(), rainingByCell: z.array(z.boolean()).optional(),
      projectedDoseSvByCohort: z.record(z.string(), z.number().finite().nonnegative()).optional(), doseRates: z.array(rate).max(10000).optional(),
      referenceBreathingRateCubicMetresPerSecond: z.number().finite().positive().optional() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    await this.projects.resolveAccess(doc.projectId, actor);
    const mef = doc.mef as RadiologicalConsequenceAnalysis, model = mef.protectiveActionParameters.earlyResponseModel;
    const site = mef.protectiveActionParameters.siteAndReceptors;
    if (!model || !site) throw new BadRequestException("Save Step 02 site and response inputs before calculating response");
    const source = mef.releaseCategoryToConsequence.releaseCategoryInputs.find(category => category.releaseCategory === categoryId)?.sourceTerm;
    const dose = mef.dosimetry.doseInputs?.categories.find(category => category.categoryId === categoryId);
    if (!source || !dose?.settings || dose.savedForSourceRevision !== source.revision)
      throw new BadRequestException("Save current Step 01 and Step 05 inputs for this release category first");
    if (!parsed.data.doseRates?.length) throw new BadRequestException("The file needs time-resolved doseRates");
    return calculateEarlyResponse(model, site, { ...parsed.data, integrationSeconds: dose.settings.integrationSeconds } as RcResponseCalculationInput);
  }
}
