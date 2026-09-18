import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcWeatherInputs } from "interfaces-mef-types/rc/weather";
import { RcWeatherDatesSchema, RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcWeather, parseRcWeatherConfiguration } from "interfaces-shared-types/rc-workbooks/weather-parser";
import { sameWeatherSite, weatherIssues, weatherSourceDistance } from "interfaces-shared-types/rc-workbooks/weather";
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
    const weather = mef.meteorologicalData.weatherInputs, site = mef.protectiveActionParameters.siteAndReceptors?.settings ?? {};
    if (write) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can edit weather inputs");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Weather inputs are locked during review and approval");
      if (!revision.safeParse(baseRevision).success) throw new BadRequestException("A weather-input revision is required");
      if ((weather?.revision ?? 0) !== baseRevision) throw new ConflictException("Weather inputs changed. Reload before saving");
    }
    return { doc, mef, weather, site };
  }
  private async persist(loaded: Awaited<ReturnType<RcWeatherService["load"]>>, weather: RcWeatherInputs) {
    const { doc, mef } = loaded, next = { ...weather, revision: doc.__v + 1 };
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef,
      meteorologicalData: { ...mef.meteorologicalData, weatherInputs: next },
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
    if (data) {
      next.data = data; next.weatherFile = metadata;
      // A replacement has no inferred connection to the preceding file's metadata.
      next.settings = {}; delete next.configuration; delete next.configurationFile;
    } else if (configuration) {
      next.configuration = configuration; next.configurationFile = metadata;
      next.settings = { latitude: configuration.latitude, longitude: configuration.longitude, year: Number(configuration.dateGroups[0].start.slice(0, 4)), windSectors: configuration.windSectors };
    }
    try { return await this.persist(loaded, next); }
    catch (e) { try { await this.documents.discardUnlinkedInputOriginal(id, original.documentId); } catch { this.logger.warn(`Could not clean up unsuccessful weather import ${original.documentId}`); } throw e; }
  }
  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, settings: RcWeatherSettingsSchema, confirm: z.boolean().optional() }).strict().safeParse(body);
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
    const next: RcWeatherInputs = { ...old, revision: 1, settings }; delete next.review;
    if (parsed.data.confirm) {
      const issues = weatherIssues(next, loaded.site); if (issues.length) throw new BadRequestException(issues.join(" "));
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
}
