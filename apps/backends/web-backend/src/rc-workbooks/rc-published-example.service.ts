import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import type { RcCaseRecords, RcCaseSnapshot } from "interfaces-mef-types/rc/case-records";
import { caseChecks, caseDuration, caseFiles, caseReceptorCount, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { RC_PUBLISHED_CATEGORY, RC_PUBLISHED_FILES, publishedRcFileMetadata, readRcPublishedFile } from "../example-workbooks/seeds/rc-published-inputs-seed";
import { RcDocumentsService } from "./rc-documents.service";

/** Materialize originals inside the receiving workbook; example templates never point at another workbook's storage. */
@Injectable()
export class RcPublishedExampleService {
  constructor(private readonly documents: RcDocumentsService) {}
  async prepare(workbookId: string, template: RadiologicalConsequenceAnalysis, revision: number, actor: { username: string }) {
    const created: string[] = [], replacements = new Map<string, { documentId: string; uploadedAt: string }>();
    try {
      for (const asset of RC_PUBLISHED_FILES.filter(f => f.kind !== "reference")) {
        const bytes = readRcPublishedFile(asset.filename), metadata = publishedRcFileMetadata(asset.filename);
        const entry = await this.documents.upload(workbookId, { buffer: bytes, originalName: asset.filename, mimeType: "text/plain", size: bytes.length }, actor,
          asset.kind === "source", asset.kind === "site", asset.kind === "weather", asset.kind === "transport", asset.kind === "dose");
        created.push(entry.documentId); replacements.set(metadata.documentId, { documentId: entry.documentId, uploadedAt: entry.uploadedAt });
      }
      const replace = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(replace);
        if (!value || typeof value !== "object") return value;
        const record = value as Record<string, unknown>, mapped = replacements.get(String(record.documentId));
        return Object.fromEntries(Object.entries({ ...record, ...mapped }).map(([key, child]) => [key, replace(child)]));
      };
      const mef = replace(template) as RadiologicalConsequenceAnalysis;
      mef.releaseCategoryToConsequence.releaseCategoryInputs.forEach(c => { if (c.sourceTerm) c.sourceTerm.revision = revision; });
      const site = mef.protectiveActionParameters.siteAndReceptors, weather = mef.meteorologicalData.weatherInputs, transport = mef.atmosphericTransportAndDispersion.transportInputs, dose = mef.dosimetry.doseInputs;
      if (site) site.revision = revision; if (weather) weather.revision = revision; if (transport) transport.revision = revision; if (dose) dose.revision = revision;
      const data = currentRcCase(mef, RC_PUBLISHED_CATEGORY), checks = caseChecks(data), manifest = caseFiles(data);
      const bytes = Buffer.from(JSON.stringify({ inputs: data, checks, files: manifest }, null, 2), "utf8");
      const entry = await this.documents.upload(workbookId, { buffer: bytes, originalName: "Published-RC-input-snapshot.json", mimeType: "text/plain", size: bytes.length }, actor, false, false, false, false, false, true);
      created.push(entry.documentId);
      const file = { documentId: entry.documentId, filename: entry.filename, size: bytes.length, uploadedAt: entry.uploadedAt, sha256: createHash("sha256").update(bytes).digest("hex") };
      const snapshot: RcCaseSnapshot = { id: entry.documentId, label: "Published inputs", categoryId: RC_PUBLISHED_CATEGORY, file, inputHash: createHash("sha256").update(JSON.stringify(data)).digest("hex"), createdBy: actor.username,
        reviewItems: checks.reduce((n, c) => n + c.items.length, 0), inventoryCount: data.source?.values.inventory.length ?? 0, receptorCount: caseReceptorCount(data), trialCount: weather?.data?.recordCount ?? 0, integrationSeconds: caseDuration(data) };
      mef.consequenceQuantification.caseRecords = { revision, snapshots: [snapshot], results: [] } satisfies RcCaseRecords;
      return { mef: RadiologicalConsequenceAnalysisSchema.parse(mef), created };
    } catch (error) { await this.rollback(workbookId, created); throw error; }
  }
  async rollback(workbookId: string, documentIds: string[]) {
    // Removal checks both current and previous MEF references before deleting an artifact.
    await Promise.allSettled(documentIds.map(id => this.documents.discardUnlinkedInputOriginal(workbookId, id)));
  }
}
