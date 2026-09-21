import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcWeatherInputs, RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { RcWeatherDatesSchema, RcWeatherModelSchema, RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcWeather, parseRcWeatherConfiguration } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { sameWeatherSite, weatherIssues, weatherRecoveryPercent, weatherSourceDistance } from "interfaces-shared-types/rc-workbooks/weather";
import { defaultWeatherModel, generateWeatherTrials } from "interfaces-shared-types/rc-workbooks/weather-trials";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

interface Actor { username: string }
const revision = z.number().int().nonnegative();
@Injectable()
export class RcWeatherService {
  private readonly logger = new Logger(RcWeatherService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService, private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}
  private async load(id: string, baseRevision: unknown, actor: Actor, write = true) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor), mef = doc.mef as RadiologicalConsequenceAnalysis;
    const weather = mef.meteorologicalData.weatherInputs, siteInputs = mef.protectiveActionParameters.siteAndReceptors, site = siteInputs?.settings ?? {};
    if (write) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can edit weather inputs");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Weather inputs are locked during review and approval");
      if (!revision.safeParse(baseRevision).success) throw new BadRequestException("A weather-input revision is required");
      if ((weather?.revision ?? 0) !== baseRevision) throw new ConflictException("Weather inputs changed. Reload before saving");
    }
    return { doc, mef, weather, site, geometry: siteInputs?.geometry };
  }
  private async persist(loaded: Awaited<ReturnType<RcWeatherService["load"]>>, weather: RcWeatherInputs,
    analysisPatch: Partial<RadiologicalConsequenceAnalysis["meteorologicalData"]> = {}) {
    const { doc, mef } = loaded, next = { ...weather, revision: doc.__v + 1 };
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef,
      meteorologicalData: { ...mef.meteorologicalData, ...analysisPatch, weatherInputs: next },
    })) }, $inc: { __v: 1 } }).exec();
    if (!saved.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving weather inputs");
    return next;
  }
  async importFile(id: string, kind: "weather" | "configuration", baseRevision: unknown, file: { buffer: Buffer; originalname: string }, actor: Actor) {
    const loaded = await this.load(id, baseRevision, actor);
    if (!file.buffer.length || file.buffer.length > 8 * 1024 * 1024) throw new BadRequestException("Choose a nonempty text file up to 8 MB");
    let data: RcWeatherInputs["data"], configuration: RcWeatherInputs["configuration"];
    try { const raw = decodeRcText(file.buffer); if (kind === "weather") data = parseRcWeather(raw).data; else configuration = parseRcWeatherConfiguration(raw); }
    catch (e) { throw new BadRequestException(e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : e instanceof Error ? e.message : "Invalid weather input"); }
    const filename = file.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "weather-input.txt";
    const original = await this.documents.upload(id, { buffer: file.buffer, originalName: filename, size: file.buffer.length, mimeType: "text/plain" }, actor, false, false, true);
    const metadata = { documentId: original.documentId, filename, size: file.buffer.length, uploadedAt: original.uploadedAt, sha256: createHash("sha256").update(file.buffer).digest("hex") };
    const next: RcWeatherInputs = { ...loaded.weather, revision: 1, settings: { ...loaded.weather?.settings } };
    delete next.review;
    delete next.trialSet;
    let analysisPatch: Partial<RadiologicalConsequenceAnalysis["meteorologicalData"]> = {};
    if (data) {
      next.data = data; next.weatherFile = metadata;
      // A replacement has no inferred connection to the preceding file's metadata.
      next.settings = {}; next.model = defaultWeatherModel(data); delete next.configuration; delete next.configurationFile;
      const recovery = weatherRecoveryPercent(next)!;
      analysisPatch = {
        dataSource: filename,
        dataRecovery: { ...loaded.mef.meteorologicalData.dataRecovery, combinedRecoveryPercent: recovery, meetsNinetyPercent: recovery >= 90 },
        extractedParameters: { windSpeedAndDirection10m: true, stabilityClassMeasurement: true, precipitation: true },
        timeResolution: `${data.intervalMinutes} min`,
      };
    } else if (configuration) {
      next.configuration = configuration; next.configurationFile = metadata;
      next.settings = { latitude: configuration.latitude, longitude: configuration.longitude, year: Number(configuration.dateGroups[0].start.slice(0, 4)), windSectors: configuration.windSectors };
      const method = { TEMPERATURE_GRADIENT: "Temperature gradient", TURNER: "Turner", SRDT: "Solar radiation and temperature gradient" }[configuration.stabilityMethod];
      const recovery = weatherRecoveryPercent(next);
      analysisPatch = {
        periodSelection: { ...loaded.mef.meteorologicalData.periodSelection,
          periodDescription: configuration.dateGroups.map(group => `${group.start} to ${group.end}`).join("; ") },
        stabilityClassificationMethod: { approach: "RECOGNIZED_SOURCE", description: `${method} · ${filename}` },
        mixingHeights: configuration.perRecordMixingHeight ? undefined : { scope: "SEASONAL_MORNING_AND_AFTERNOON", source: filename },
        timeResolution: `${configuration.intervalMinutes} min`,
        dataRecovery: { ...loaded.mef.meteorologicalData.dataRecovery, combinedRecoveryPercent: recovery, meetsNinetyPercent: recovery === undefined ? undefined : recovery >= 90 },
      };
    }
    try { return await this.persist(loaded, next, analysisPatch); }
    catch (e) { try { await this.documents.discardUnlinkedInputOriginal(id, original.documentId); } catch { this.logger.warn(`Could not clean up unsuccessful weather import ${original.documentId}`); } throw e; }
  }
  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, settings: RcWeatherSettingsSchema, model: RcWeatherModelSchema, confirm: z.boolean().optional() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join("; "));
    const loaded = await this.load(id, parsed.data.baseRevision, actor), settings = { ...parsed.data.settings }, old = loaded.weather;
    if (old?.configuration && (settings.year !== Number(old.configuration.dateGroups[0].start.slice(0, 4)) || settings.windSectors !== old.configuration.windSectors))
      throw new BadRequestException("Year and sectors must match the imported generation settings");
    if (old?.data?.windSectors !== undefined && settings.windSectors !== undefined && settings.windSectors !== old.data.windSectors)
      throw new BadRequestException("The wind-sector count must match the weather file");
    if (settings.nearbySite && !sameWeatherSite(settings.nearbySite, loaded.site)) {
      if ((weatherSourceDistance({ revision: 1, settings }, loaded.site) ?? Infinity) <= .05) delete settings.nearbySite;
      else throw new ConflictException("The Step 02 site changed. Review the weather source again");
    }
    const pending: RcWeatherInputs = { ...old, revision: 1, settings, model: parsed.data.model }; delete pending.review; delete pending.trialSet;
    const issues = weatherIssues(pending, loaded.site, loaded.geometry, false);
    if (issues.length) throw new BadRequestException(issues.join(" "));
    let records: RcWeatherRecord[] = [];
    if (parsed.data.model.mode !== "constant") {
      if (!old?.weatherFile) throw new BadRequestException("Import the weather records");
      records = parseRcWeather(decodeRcText(await this.documents.readWeatherInput(id, old.weatherFile.documentId, actor))).records;
    }
    let generated: ReturnType<typeof generateWeatherTrials>;
    try { generated = generateWeatherTrials(pending, records); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Could not generate weather trials"); }
    const next: RcWeatherInputs = { ...pending, trialSet: { ...generated.summary, generatedAt: new Date().toISOString() } };
    if (parsed.data.confirm) {
      const reviewIssues = weatherIssues(next, loaded.site, loaded.geometry); if (reviewIssues.length) throw new BadRequestException(reviewIssues.join(" "));
      next.review = { latitude: loaded.site.latitude!, longitude: loaded.site.longitude!, reviewedAt: new Date().toISOString(), reviewedBy: actor.username };
    }
    return this.persist(loaded, next);
  }
  async prepareCollection(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, siteRevision: revision, dates: RcWeatherDatesSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join("; "));
    const loaded = await this.load(id, parsed.data.baseRevision, actor);
    if ((loaded.mef.protectiveActionParameters.siteAndReceptors?.revision ?? 0) !== parsed.data.siteRevision) throw new ConflictException("The Step 02 site changed. Review it before preparing the request");
    if (loaded.site.latitude === undefined || loaded.site.longitude === undefined) throw new BadRequestException("Set the release latitude and longitude in Step 02");
    return this.persist(loaded, { ...loaded.weather, revision: 1, settings: loaded.weather?.settings ?? {}, collectionRequest: {
      status: "prepared", latitude: loaded.site.latitude, longitude: loaded.site.longitude, ...parsed.data.dates, preparedAt: new Date().toISOString(),
    } });
  }
  async original(id: string, documentId: string, actor: Actor) {
    return { text: decodeRcText(await this.documents.readWeatherInput(id, documentId, actor)) };
  }
  async records(id: string, offset: number, limit: number, actor: Actor) {
    const { weather } = await this.load(id, undefined, actor, false);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new BadRequestException("Use a nonnegative offset and a limit from 1 to 1000");
    if (!weather?.weatherFile) throw new NotFoundException("Import a weather file first");
    const raw = await this.documents.readWeatherInput(id, weather.weatherFile.documentId, actor);
    const { records } = parseRcWeather(decodeRcText(raw));
    return { revision: weather.revision, total: records.length, offset, records: records.slice(offset, offset + limit) };
  }
  async trials(id: string, offset: number, limit: number, actor: Actor) {
    const loaded = await this.load(id, undefined, actor, false), weather = loaded.weather;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new BadRequestException("Use a nonnegative offset and a limit from 1 to 1000");
    if (!weather?.model || !weather.trialSet) throw new NotFoundException("Generate the weather trials first");
    let records: RcWeatherRecord[] = [];
    if (weather.model.mode !== "constant") {
      if (!weather.weatherFile) throw new NotFoundException("Import a weather file first");
      records = parseRcWeather(decodeRcText(await this.documents.readWeatherInput(id, weather.weatherFile.documentId, actor))).records;
    }
    const { trials } = generateWeatherTrials(weather, records);
    return { revision: weather.revision, total: trials.length, offset, trials: trials.slice(offset, offset + limit) };
  }
}
