import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCaseData, RcCaseDataset, RcCaseRecords, RcCaseSelection, RcCaseSnapshot, RcCaseCheck, RcCaseFile } from "interfaces-mef-types/rc/case-records";
import type { RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { RcCaseRecordsSchema, RcLinkedResultValuesSchema } from "interfaces-mef-types/zod/rc/case-records";
import { caseChecks, caseDatasets, caseDuration, caseFiles, caseReceptorCount, caseReceptorIds, caseTable, caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcWeather } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { generateWeatherTrials } from "interfaces-shared-types/rc-workbooks/weather-trials";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

interface Actor { username: string }
const revision = z.number().int().nonnegative(), versions = z.string().regex(/^\d+,\d+,\d+,\d+,\d+,\d+$/);
const reason = (e: unknown) => e instanceof z.ZodError ? e.issues.slice(0, 5).map(i => i.message).join("; ") : e instanceof Error ? e.message : "Invalid case record";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const selectionSchema = z.object({ categoryId: z.string().min(1).max(255), versions, snapshotId: z.string().uuid().optional() }).strict();
@Injectable()
export class RcCaseRecordsService {
  private readonly logger = new Logger(RcCaseRecordsService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>, private readonly projects: ProjectsService,
    private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}
  private async load(id: string, actor: Actor, baseRevision?: number) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor), mef = doc.mef as RadiologicalConsequenceAnalysis, records = mef.consequenceQuantification.caseRecords;
    if (baseRevision !== undefined) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can save case records");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Case records are locked during review and approval");
      if ((records?.revision ?? 0) !== baseRevision) throw new ConflictException("Case records changed. Reload before saving");
    }
    return { doc, mef, records };
  }
  private current(mef: RadiologicalConsequenceAnalysis, categoryId: string, expected: string) {
    if (!mef.releaseCategoryToConsequence.releaseCategoryInputs.some(c => c.releaseCategory === categoryId)) throw new NotFoundException("Release category not found");
    const data = currentRcCase(mef, categoryId);
    if (caseVersions(data) !== expected) throw new ConflictException("The saved inputs changed. Reload and review the current case");
    return data;
  }
  private async snapshot(id: string, records: RcCaseRecords | undefined, snapshotId: string, actor: Actor) {
    const summary = records?.snapshots.find(s => s.id === snapshotId);
    if (!summary) throw new NotFoundException("Input snapshot not found");
    const bytes = await this.documents.readCaseArtifact(id, summary.file.documentId, actor);
    if (hash(bytes) !== summary.file.sha256) throw new BadRequestException("The stored snapshot failed its file integrity check");
    const raw = bytes.toString("utf8"), saved = JSON.parse(raw) as { inputs: RcCaseData; checks: RcCaseCheck[]; files: RcCaseFile[] }, data = saved.inputs;
    if (data.schemaVersion !== 1 || data.categoryId !== summary.categoryId) throw new BadRequestException("Invalid snapshot data");
    return { summary, data, checks: saved.checks, files: saved.files, raw };
  }
  private async select(id: string, selection: RcCaseSelection, actor: Actor) {
    const p = selectionSchema.safeParse(selection);
    if (!p.success) throw new BadRequestException(reason(p.error));
    const loaded = await this.load(id, actor);
    return p.data.snapshotId ? (await this.snapshot(id, loaded.records, p.data.snapshotId, actor)).data : this.current(loaded.mef, p.data.categoryId, p.data.versions);
  }
  private async weatherTrials(id: string, data: RcCaseData, actor: Actor) {
    if (!data.weather?.model || !data.weather.trialSet) return [];
    let records: RcWeatherRecord[] = [];
    if (data.weather.model.mode !== "constant") {
      if (!data.weather.weatherFile) return [];
      const bytes = await this.documents.readWeatherInput(id, data.weather.weatherFile.documentId, actor);
      if (hash(bytes) !== data.weather.weatherFile.sha256) throw new BadRequestException("The weather original failed its file integrity check");
      records = parseRcWeather(decodeRcText(bytes)).records;
    }
    return generateWeatherTrials(data.weather, records).trials;
  }
  private async persist(loaded: Awaited<ReturnType<RcCaseRecordsService["load"]>>, records: RcCaseRecords) {
    const { doc, mef } = loaded;
    let next: RcCaseRecords;
    try { next = RcCaseRecordsSchema.parse({ ...records, revision: doc.__v + 1 }); } catch (e) { throw new BadRequestException(reason(e)); }
    const result = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef, consequenceQuantification: { ...mef.consequenceQuantification, caseRecords: next } })) }, $inc: { __v: 1 } }).exec();
    if (!result.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving this case record");
    return next;
  }
  private async store(id: string, filename: string, bytes: Buffer, actor: Actor) {
    const entry = await this.documents.upload(id, { buffer: bytes, originalName: filename, mimeType: "text/plain", size: bytes.length }, actor, false, false, false, false, false, true);
    return { documentId: entry.documentId, filename, sha256: hash(bytes), size: bytes.length, uploadedAt: entry.uploadedAt };
  }
  private async rollback(id: string, documentId: string) {
    try { await this.documents.discardUnlinkedInputOriginal(id, documentId); } catch { this.logger.warn(`Could not clean up unsuccessful case record ${documentId}`); }
  }
  async saveSnapshot(id: string, body: unknown, actor: Actor) {
    const p = z.object({ baseRevision: revision, categoryId: z.string().min(1).max(255), versions }).strict().safeParse(body);
    if (!p.success) throw new BadRequestException(reason(p.error));
    const loaded = await this.load(id, actor, p.data.baseRevision), data = this.current(loaded.mef, p.data.categoryId, p.data.versions);
    const inputHash = hash(Buffer.from(JSON.stringify(data), "utf8")), records: RcCaseRecords = loaded.records ?? { revision: 1, snapshots: [], results: [] };
    const existing = records.snapshots.find(s => s.inputHash === inputHash);
    if (existing) return { records, snapshotId: existing.id };
    if (records.snapshots.length >= 100) throw new BadRequestException("This workbook already contains 100 input snapshots");
    const checks = caseChecks(data), manifest = caseFiles(data), weather = await this.weatherTrials(id, data, actor);
    // Originals stay immutable and retained; snapshots store their document IDs and byte hashes.
    for (const entry of manifest) {
      const bytes = await this.originalBytes(id, entry.kind, entry.file.documentId, actor);
      if (hash(bytes) !== entry.file.sha256) throw new BadRequestException(`Original file failed its integrity check: ${entry.file.filename}`);
    }
    const label = `Case ${String(records.snapshots.length + 1).padStart(2, "0")}`;
    const bytes = Buffer.from(JSON.stringify({ inputs: data, checks, files: manifest }, null, 2), "utf8");
    const file = await this.store(id, `${label.replace(/ /g, "-")}-inputs.json`, bytes, actor);
    const snapshot: RcCaseSnapshot = { id: file.documentId, label, categoryId: data.categoryId, file, inputHash, createdBy: actor.username,
      reviewItems: checks.reduce((n, c) => n + c.items.length, 0), inventoryCount: data.source?.values.inventory.length ?? 0, receptorCount: caseReceptorCount(data), trialCount: weather.length, integrationSeconds: caseDuration(data) };
    try { return { records: await this.persist(loaded, { ...records, snapshots: [...records.snapshots, snapshot] }), snapshotId: snapshot.id }; }
    catch (e) { await this.rollback(id, file.documentId); throw e; }
  }
  async saveResult(id: string, body: unknown, upload: { buffer: Buffer; originalname: string }, actor: Actor) {
    const p = z.object({ baseRevision: revision, result: RcLinkedResultValuesSchema }).strict().safeParse(body);
    if (!p.success) throw new BadRequestException(reason(p.error));
    const loaded = await this.load(id, actor, p.data.baseRevision), { data } = await this.snapshot(id, loaded.records, p.data.result.snapshotId, actor);
    if (loaded.records!.results.length >= 1000) throw new BadRequestException("This workbook already contains 1000 linked results");
    if (!caseReceptorIds(data).includes(p.data.result.receptorId)) throw new BadRequestException("Choose a receptor from the selected input snapshot");
    if (!(await this.weatherTrials(id, data, actor)).some(trial => trial.id === p.data.result.trialId)) throw new BadRequestException("Choose a weather trial from the selected input snapshot");
    const duration = caseDuration(data);
    if (!(duration !== undefined && Number.isFinite(duration) && duration > 0)) throw new BadRequestException("The selected snapshot needs a positive integration time");
    if (!upload.buffer.length || upload.buffer.length > 15 * 1024 * 1024 || !/\.(txt|out|log|csv|dat)$/i.test(upload.originalname)) throw new BadRequestException("Choose a nonempty .txt, .out, .log, .csv or .dat output up to 15 MB");
    try { if (!decodeRcText(upload.buffer).trim()) throw new Error("The output is empty"); } catch (e) { throw new BadRequestException(reason(e)); }
    const filename = upload.originalname.replace(/^.*[\\/]/, "").slice(0, 255);
    const file = await this.store(id, filename, upload.buffer, actor);
    try {
      return await this.persist(loaded, { ...loaded.records!, results: [...loaded.records!.results, { ...p.data.result, id: randomUUID(), file, integrationSeconds: duration!, recordedBy: actor.username, valueSource: "transcribed" }] });
    } catch (e) { await this.rollback(id, file.documentId); throw e; }
  }
  private offset(value: number) { if (!Number.isSafeInteger(value) || value < 0 || value > 10000000) throw new BadRequestException("Use a nonnegative page offset up to 10000000"); }
  async review(id: string, selection: RcCaseSelection, actor: Actor) {
    if (selection.snapshotId) {
      if (!selectionSchema.safeParse(selection).success) throw new BadRequestException("Invalid case selection");
      const loaded = await this.load(id, actor), saved = await this.snapshot(id, loaded.records, selection.snapshotId, actor);
      return { files: saved.files, checks: saved.checks };
    }
    const data = await this.select(id, selection, actor);
    return { files: caseFiles(data), checks: caseChecks(data) };
  }
  async table(id: string, selection: RcCaseSelection, kind: string, offset: number, actor: Actor) {
    this.offset(offset);
    if (!Object.prototype.hasOwnProperty.call(caseDatasets, kind)) throw new BadRequestException("Unknown input group");
    const data = await this.select(id, selection, actor);
    return caseTable(data, kind as RcCaseDataset, offset, kind === "weather" ? await this.weatherTrials(id, data, actor) : []);
  }
  async choices(id: string, snapshotId: string, kind: string, search: string, actor: Actor) {
    if (!["receptors", "weather"].includes(kind) || search.length > 255) throw new BadRequestException("Choose receptors or weather and a short ID prefix");
    const loaded = await this.load(id, actor), { data } = await this.snapshot(id, loaded.records, snapshotId, actor);
    const ids = kind === "receptors" ? caseReceptorIds(data) : (await this.weatherTrials(id, data, actor)).map(trial => trial.id);
    const matches = ids.filter(v => v.toLowerCase().startsWith(search.trim().toLowerCase()));
    return { ids: matches.slice(0, 25), total: matches.length };
  }
  private originalBytes(id: string, kind: string, documentId: string, actor: Actor) {
    switch (kind) {
      case "source": return this.documents.readSourceInput(id, documentId, actor);
      case "site": return this.documents.readSiteInput(id, documentId, actor);
      case "response": return this.documents.readResponseInput(id, documentId, actor);
      case "weather": return this.documents.readWeatherInput(id, documentId, actor);
      case "transport": return this.documents.readTransportInput(id, documentId, actor);
      case "dose": return this.documents.readDoseInput(id, documentId, actor);
      default: throw new BadRequestException("Unknown input file type");
    }
  }
  private textPage(raw: string, offset: number) { const lines = raw.split(/\r\n|\n|\r/); return { text: lines.slice(offset, offset + 8).join("\n"), total: lines.length, offset }; }
  async text(id: string, selection: RcCaseSelection, fileId: string, offset: number, actor: Actor) {
    this.offset(offset);
    if (selection.snapshotId && fileId === "structured") {
      if (!selectionSchema.safeParse(selection).success) throw new BadRequestException("Invalid case selection");
      const loaded = await this.load(id, actor), saved = await this.snapshot(id, loaded.records, selection.snapshotId, actor);
      return this.textPage(saved.raw, offset);
    }
    const data = await this.select(id, selection, actor);
    if (fileId === "structured") return this.textPage(JSON.stringify({ inputs: data, checks: caseChecks(data), files: caseFiles(data) }, null, 2), offset);
    const entry = caseFiles(data).find(f => f.file.documentId === fileId);
    if (!entry) throw new NotFoundException("File is not part of the selected case");
    return this.textPage(decodeRcText(await this.originalBytes(id, entry.kind, fileId, actor)), offset);
  }
  async output(id: string, resultId: string, offset: number, actor: Actor) {
    this.offset(offset);
    const loaded = await this.load(id, actor), result = loaded.records?.results.find(r => r.id === resultId);
    if (!result) throw new NotFoundException("Linked result not found");
    const bytes = await this.documents.readCaseArtifact(id, result.file.documentId, actor);
    if (hash(bytes) !== result.file.sha256) throw new BadRequestException("The output failed its file integrity check");
    return this.textPage(decodeRcText(bytes), offset);
  }
}
