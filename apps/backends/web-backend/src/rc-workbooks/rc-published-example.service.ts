import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import type { RcCaseRecords, RcCaseSnapshot, RcCategoryResult } from "interfaces-mef-types/rc/case-records";
import { caseChecks, caseFiles, caseReceptorCount, caseSnapshotMetrics, caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { withRcFamilyConsequences } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { RC_PUBLISHED_CATEGORY, RC_PUBLISHED_FILES, publishedRcFileMetadata, readRcPublishedFile } from "../example-workbooks/seeds/rc-published-inputs-seed";
import { exampleResultsText } from "../example-workbooks/seeds/rc-example-results";
import { RcDocumentsService } from "./rc-documents.service";

type Actor = { username: string };
type StoredFile = RcCaseSnapshot["file"];

/** Materialize originals inside the receiving workbook; example templates never point at another workbook's storage. */
@Injectable()
export class RcPublishedExampleService {
  constructor(private readonly documents: RcDocumentsService) {}
  private async storeCaseFile(workbookId: string, filename: string, text: string, actor: Actor, created: string[]): Promise<StoredFile> {
    const bytes = Buffer.from(text, "utf8");
    const entry = await this.documents.upload(workbookId, { buffer: bytes, originalName: filename, mimeType: "text/plain", size: bytes.length }, actor, false, false, false, false, false, true);
    created.push(entry.documentId);
    return { documentId: entry.documentId, filename: entry.filename, size: bytes.length, uploadedAt: entry.uploadedAt, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  private async snapshot(workbookId: string, mef: RadiologicalConsequenceAnalysis, categoryId: string, label: string, filename: string, actor: Actor, created: string[]): Promise<RcCaseSnapshot> {
    const data = currentRcCase(mef, categoryId), checks = caseChecks(data), manifest = caseFiles(data);
    const file = await this.storeCaseFile(workbookId, filename, JSON.stringify({ inputs: data, checks, files: manifest }, null, 2), actor, created);
    return { id: file.documentId, label, categoryId, file, inputHash: createHash("sha256").update(JSON.stringify(data)).digest("hex"), createdBy: actor.username,
      reviewItems: checks.reduce((n, c) => n + c.items.length, 0), inventoryCount: data.source?.values.inventory.length ?? 0, receptorCount: caseReceptorCount(data),
      trialCount: data.weather?.data?.recordCount ?? 0, metrics: caseSnapshotMetrics(data), versions: caseVersions(data) };
  }
  async prepare(workbookId: string, template: RadiologicalConsequenceAnalysis, revision: number, actor: Actor) {
    const created: string[] = [], replacements = new Map<string, { documentId: string; uploadedAt: string }>();
    try {
      const templateJson = JSON.stringify(template);
      for (const asset of RC_PUBLISHED_FILES.filter(f => f.kind !== "reference")) {
        const metadata = publishedRcFileMetadata(asset.filename);
        if (!templateJson.includes(metadata.documentId)) continue;
        const bytes = readRcPublishedFile(asset.filename);
        const entry = await this.documents.upload(workbookId, { buffer: bytes, originalName: asset.filename, mimeType: "text/plain", size: bytes.length }, actor,
          asset.kind === "source", asset.kind === "site", asset.kind === "weather", asset.kind === "transport", asset.kind === "dose", false, asset.kind === "response");
        created.push(entry.documentId); replacements.set(metadata.documentId, { documentId: entry.documentId, uploadedAt: entry.uploadedAt });
      }
      const replace = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(replace);
        if (!value || typeof value !== "object") return value;
        const record = value as Record<string, unknown>, mapped = replacements.get(String(record.documentId));
        return Object.fromEntries(Object.entries({ ...record, ...mapped }).map(([key, child]) => [key, replace(child)]));
      };
      const mef = replace(template) as RadiologicalConsequenceAnalysis;
      const templateSources = new Map(template.releaseCategoryToConsequence.releaseCategoryInputs.map(c => [c.releaseCategory, c.sourceTerm?.revision]));
      const current = (categoryId: string, saved: number | undefined) => saved !== undefined && saved === templateSources.get(categoryId) ? revision : saved;
      mef.releaseCategoryToConsequence.releaseCategoryInputs.forEach(c => { if (c.sourceTerm) c.sourceTerm.revision = revision; });
      const site = mef.protectiveActionParameters.siteAndReceptors, weather = mef.meteorologicalData.weatherInputs, transport = mef.atmosphericTransportAndDispersion.transportInputs, dose = mef.dosimetry.doseInputs;
      if (site) site.revision = revision; if (weather) weather.revision = revision; if (transport) transport.revision = revision; if (dose) dose.revision = revision;
      transport?.categories.forEach(c => { c.savedForSourceRevision = current(c.categoryId, c.savedForSourceRevision); });
      dose?.categories.forEach(c => { c.savedForSourceRevision = current(c.categoryId, c.savedForSourceRevision); });
      if (mef.economicFactors.siteEconomyInput?.sourceSiteRevision !== undefined) mef.economicFactors.siteEconomyInput.sourceSiteRevision = revision;
      if (mef.protectiveActionParameters.earlyResponseModel) mef.protectiveActionParameters.earlyResponseModel.revision = revision;
      const records = template.consequenceQuantification.caseRecords;
      if (records?.snapshots.length) {
        const snapshots: RcCaseSnapshot[] = [], results: RcCategoryResult[] = [];
        for (const saved of records.snapshots) {
          const snapshot = await this.snapshot(workbookId, mef, saved.categoryId, saved.label, saved.file.filename, actor, created);
          snapshots.push(snapshot);
          const rows = records.results.filter(result => result.snapshotId === saved.id);
          if (!rows.length) continue;
          const title = rows[0].reference.slice(0, Math.max(0, rows[0].reference.lastIndexOf(" example")));
          const file = await this.storeCaseFile(workbookId, rows[0].file.filename, exampleResultsText(title, saved.categoryId, saved.label, mef.scope.metrics ?? [], rows), actor, created);
          results.push(...rows.map(row => ({ ...row, id: randomUUID(), snapshotId: snapshot.id, file, recordedBy: actor.username })));
        }
        mef.consequenceQuantification.caseRecords = { revision, snapshots, results } satisfies RcCaseRecords;
      } else {
        const snapshot = await this.snapshot(workbookId, mef, RC_PUBLISHED_CATEGORY, "Published inputs", "Published-RC-input-snapshot.json", actor, created);
        mef.consequenceQuantification.caseRecords = { revision, snapshots: [snapshot], results: [] } satisfies RcCaseRecords;
      }
      return { mef: RadiologicalConsequenceAnalysisSchema.parse(withRcFamilyConsequences(mef)), created };
    } catch (error) { await this.rollback(workbookId, created); throw error; }
  }
  async rollback(workbookId: string, documentIds: string[]) {
    // Removal checks both current and previous MEF references before deleting an artifact.
    await Promise.allSettled(documentIds.map(id => this.documents.discardUnlinkedInputOriginal(workbookId, id)));
  }
}
