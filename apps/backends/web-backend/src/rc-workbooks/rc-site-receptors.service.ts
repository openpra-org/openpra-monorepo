import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { z } from "zod";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import { RcSiteSettingsSchema } from "interfaces-mef-types/zod/rc/site-receptors";
import { decodeRcText } from "interfaces-shared-types/rc-workbooks/source-term-parser";
import { parseRcReceptorGeometry, parseRcSiteCoordinates } from "interfaces-shared-types/rc-workbooks/site-receptor-parser";
import { evaluatedReceptor, receptorCount, siteReceptorIssues } from "interfaces-shared-types/rc-workbooks/site-receptors";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";

interface Actor { username: string }
const revision = z.number().int().nonnegative();
@Injectable()
export class RcSiteReceptorsService {
  private readonly logger = new Logger(RcSiteReceptorsService.name);
  constructor(@InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService, private readonly roles: WorkbookRolesService, private readonly documents: RcDocumentsService) {}
  private async load(id: string, baseRevision: unknown, actor: Actor, write = true) {
    const doc = await this.workbooks.findOne({ workbookId: id }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(doc.projectId, actor);
    const mef = doc.mef as RadiologicalConsequenceAnalysis;
    const site = mef.protectiveActionParameters.siteAndReceptors;
    if (write) {
      const roles = await this.roles.resolveEffectiveRoles(id, actor.username);
      if (access.role === "viewer" || !roles.some(r => r === "preparer" || r === "co_preparer")) throw new ForbiddenException("Only preparers can edit site and receptor inputs");
      if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) throw new ForbiddenException("Site inputs are locked during review and approval");
      if (!revision.safeParse(baseRevision).success) throw new BadRequestException("A site-input revision is required");
      if ((site?.revision ?? 0) !== baseRevision) throw new ConflictException("Site inputs changed. Reload before saving");
    }
    return { doc, mef, site };
  }
  private async persist(loaded: Awaited<ReturnType<RcSiteReceptorsService["load"]>>, site: RcSiteReceptors) {
    const { doc, mef } = loaded;
    const next = { ...site, revision: doc.__v + 1 };
    const saved = await this.workbooks.updateOne({ _id: doc._id, __v: doc.__v }, { $set: { mef: JSON.parse(JSON.stringify({ ...mef,
      protectiveActionParameters: { ...mef.protectiveActionParameters, siteAndReceptors: next },
    })) }, $inc: { __v: 1 } }).exec();
    if (!saved.modifiedCount) throw new ConflictException("The workbook changed. Reload before saving site inputs");
    return next;
  }
  async importFile(id: string, kind: "location" | "geometry", baseRevision: unknown, file: { buffer: Buffer; originalname: string }, actor: Actor) {
    const loaded = await this.load(id, baseRevision, actor);
    if (!file.buffer.length || file.buffer.length > 5 * 1024 * 1024) throw new BadRequestException("Choose a nonempty text file up to 5 MB");
    let geometry: RcSiteReceptors["geometry"], location: ReturnType<typeof parseRcSiteCoordinates> | undefined;
    try { const raw = decodeRcText(file.buffer); if (kind === "geometry") geometry = parseRcReceptorGeometry(raw); else location = parseRcSiteCoordinates(raw); }
    catch (error) { throw new BadRequestException(error instanceof z.ZodError ? error.issues.map(i => i.message).join("; ") : error instanceof Error ? error.message : "Invalid site input"); }
    const filename = file.originalname.replace(/^.*[\\/]/, "").slice(0, 255) || "site-input.txt";
    const original = await this.documents.upload(id, { buffer: file.buffer, originalName: filename, size: file.buffer.length, mimeType: "text/plain" }, actor, false, true);
    const metadata = { documentId: original.documentId, filename, size: file.buffer.length, uploadedAt: original.uploadedAt, sha256: createHash("sha256").update(file.buffer).digest("hex") };
    const old = loaded.site;
    const next: RcSiteReceptors = { ...old, revision: 1, settings: { ...old?.settings } };
    if (location) {
      next.settings.latitude = location.latitude; next.settings.longitude = location.longitude;
      next.locationOrigin = location.origin; next.locationFile = metadata;
    } else if (geometry) {
      const autoLocation = old?.locationOrigin?.startsWith("SecPop header") && old.locationFile?.documentId === old.geometryFile?.documentId;
      next.geometry = geometry; next.geometryFile = metadata;
      delete next.settings.releaseX; delete next.settings.releaseY; delete next.settings.cellPoint; delete next.settings.receptorHeightMetres;
      if (autoLocation) { delete next.settings.latitude; delete next.settings.longitude; delete next.locationFile; delete next.locationOrigin; }
      if (geometry.kind === "cells" && geometry.center && next.settings.latitude === undefined && next.settings.longitude === undefined) {
        next.settings.latitude = geometry.center.latitude; next.settings.longitude = geometry.center.longitude;
        next.locationOrigin = geometry.center.origin; next.locationFile = metadata;
      }
    }
    try { return await this.persist(loaded, next); }
    catch (error) {
      try { await this.documents.discardUnlinkedInputOriginal(id, original.documentId); } catch { this.logger.warn(`Could not clean up unsuccessful site import ${original.documentId}`); }
      throw error;
    }
  }
  async save(id: string, body: unknown, actor: Actor) {
    const parsed = z.object({ baseRevision: revision, settings: RcSiteSettingsSchema }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join("; "));
    const loaded = await this.load(id, parsed.data.baseRevision, actor);
    const changed = loaded.site?.settings.latitude !== parsed.data.settings.latitude || loaded.site?.settings.longitude !== parsed.data.settings.longitude;
    return this.persist(loaded, { ...loaded.site, revision: 1, settings: parsed.data.settings, locationOrigin: changed ? "Manually entered coordinates" : loaded.site?.locationOrigin });
  }
  async original(id: string, documentId: string, actor: Actor) {
    const bytes = await this.documents.readSiteInput(id, documentId, actor);
    return { text: decodeRcText(bytes) };
  }
  async points(id: string, offset: number, limit: number, actor: Actor) {
    const { site } = await this.load(id, undefined, actor, false);
    const errors = siteReceptorIssues(site?.settings ?? {}, site?.geometry);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new BadRequestException("Use a nonnegative offset and a limit from 1 to 1000");
    const total = receptorCount(site!.geometry);
    return { revision: site!.revision, total, points: Array.from({ length: Math.min(limit, Math.max(0, total - offset)) }, (_, i) => evaluatedReceptor(site!.geometry!, site!.settings, offset + i)) };
  }
}
