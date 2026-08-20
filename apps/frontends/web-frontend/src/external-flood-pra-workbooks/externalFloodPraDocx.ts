import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { EXTERNAL_FLOOD_PRA_SR_CATALOG, type ExternalFloodAnalysisRecord, type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";
import { validateExternalFloodPra } from "interfaces-mef-types/external-flood/external-flood-pra-validation";

type ReportBlock = Paragraph | Table;
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph { return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 }); }
function para(text: string): Paragraph { return new Paragraph({ children: [new TextRun(text.length > 0 ? text : "Not documented.")], spacing: { after: 110 } }); }
function cell(text: string, header: boolean): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })], shading: header ? { fill: "EDF5F4" } : undefined }); }
function table(headers: string[], rows: string[][]): Table { return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headers.map((item) => cell(item, true)) }), ...rows.map((row) => new TableRow({ children: row.map((item) => cell(item, false)) }))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, left: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, right: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDE8E7" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDE8E7" } } }); }
function value(item: unknown): string { if (Array.isArray(item)) return item.map(value).join("; "); if (typeof item === "boolean") return item ? "Yes" : "No"; if (item !== null && typeof item === "object") return JSON.stringify(item); return String(item ?? ""); }
function recordsIn(input: unknown): ExternalFloodAnalysisRecord[] {
  if (input === null || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap(recordsIn);
  const item = input as Record<string, unknown>;
  if (typeof item.uuid === "string" && typeof item.code === "string" && typeof item.status === "string") return [input as ExternalFloodAnalysisRecord];
  return Object.values(item).flatMap(recordsIn);
}
function recordBlocks(record: ExternalFloodAnalysisRecord): ReportBlock[] {
  const output: ReportBlock[] = [heading(`${record.code} — ${record.name}`, HeadingLevel.HEADING_3), para(`Status: ${record.status.replace(/_/g, " ")}. Owner: ${record.owner}.`), para(record.description), para(`Technical basis: ${record.basis}`)];
  const hidden = new Set(["uuid", "code", "name", "description", "basis", "owner", "status", "evidenceRefs", "relatedRefs", "assumptionRefs", "implementsSrs"]);
  const details = Object.entries(record as unknown as Record<string, unknown>).filter(([key, entry]) => !hidden.has(key) && entry !== undefined).map(([key, entry]) => [key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " "), value(entry)]);
  if (details.length > 0) output.push(table(["Attribute", "Value"], details));
  output.push(para(`Evidence: ${record.evidenceRefs.join("; ") || "None linked"}. Related records: ${record.relatedRefs.join("; ") || "None linked"}.`));
  return output;
}
function sections(mef: ExternalFloodPRA): Array<{ title: string; description: string; records: ExternalFloodAnalysisRecord[] }> {
  return [
    { title: "Analysis Basis, Scope, and Interfaces", description: mef.documentation.analysisBasisSummary, records: recordsIn(mef.analysisBasis) },
    { title: "XFHA — Controlled Evidence and Site Basis", description: mef.documentation.evidenceAndSiteBasisSummary, records: recordsIn(mef.analysisBasis.evidenceRegister) },
    { title: "XFHA — Hazard Identification and Screening", description: mef.documentation.hazardScreeningSummary, records: recordsIn(mef.hazardScreening) },
    { title: "XFHA — Site Flood Model", description: mef.documentation.siteFloodModelSummary, records: recordsIn(mef.siteFloodModel) },
    { title: "XFHA — Local Intense Precipitation", description: mef.documentation.localIntensePrecipitationSummary, records: recordsIn(mef.localIntensePrecipitationAnalysis) },
    { title: "XFHA — Riverine Flood", description: mef.documentation.riverineFloodSummary, records: recordsIn(mef.riverineFloodAnalysis) },
    { title: "XFHA — Dam and Impoundment Analysis", description: mef.documentation.damAndImpoundmentSummary, records: recordsIn(mef.damAndImpoundmentAnalysis) },
    { title: "XFHA — Surge, Seiche, and Tsunami", description: mef.documentation.surgeSeicheTsunamiSummary, records: recordsIn(mef.surgeSeicheTsunamiAnalysis) },
    { title: "XFHA — Hazard Curves and Spatial Characterization", description: mef.documentation.hazardIntegrationSummary, records: recordsIn(mef.hazardIntegration) },
    { title: "XFPR — Preliminary Response and XFEL", description: mef.documentation.equipmentListSummary, records: recordsIn(mef.preliminaryPlantResponse) },
    { title: "XFFR — Plant Investigation and Flood Pathways", description: mef.documentation.investigationSummary, records: recordsIn(mef.plantInvestigation) },
    { title: "XFFR — Screening and Fragility Basis", description: mef.documentation.fragilitySummary, records: recordsIn(mef.sscScreeningAndFragilityBasis) },
    { title: "XFFR — Flood Protection and SSC Fragilities", description: mef.documentation.fragilitySummary, records: recordsIn(mef.floodFragilityAnalysis) },
    { title: "XFPR — Flood Scenarios and Timelines", description: mef.documentation.scenarioSummary, records: recordsIn(mef.scenarioDevelopment) },
    { title: "XFPR — Plant-Response Model", description: mef.documentation.plantResponseSummary, records: recordsIn(mef.plantResponseModel) },
    { title: "XFPR — Human Reliability Analysis", description: mef.documentation.humanReliabilitySummary, records: recordsIn(mef.humanReliabilityAnalysis) },
    { title: "XFPR — Event-Sequence Quantification", description: mef.documentation.quantificationSummary, records: recordsIn(mef.eventSequenceQuantification) },
    { title: "Risk Interpretation", description: mef.documentation.riskInsights, records: recordsIn(mef.riskInterpretation) },
    { title: "Risk Integration and Controlled Baseline", description: mef.documentation.configurationControlDescription, records: recordsIn(mef.riskIntegration) },
    { title: "Technical Closure and Peer-Review Readiness", description: mef.documentation.peerReviewScope, records: recordsIn(mef.technicalClosure) },
    { title: "Workflow and Approval", description: mef.documentation.configurationControlDescription, records: recordsIn(mef.workflow) },
  ];
}
function buildChildren(mef: ExternalFloodPRA, final: boolean): ReportBlock[] {
  const diagnostics = validateExternalFloodPra(mef);
  const site = mef.metadata.plantIdentity;
  const output: ReportBlock[] = [new Paragraph({ children: [new TextRun({ text: mef.name, bold: true, size: 48, color: "1F5753" })], spacing: { after: 80 } }), new Paragraph({ children: [new TextRun({ text: "External Flood Probabilistic Risk Assessment", size: 28, color: "496F6C" })], spacing: { after: 160 } }), para(`Plant: ${site?.name ?? "Not specified"}. Reactor type: ${site?.reactorType ?? "Not specified"}. Plant stage: ${mef.plantStage.replace(/_/g, " ")}. Model version: ${mef.version}.`), para(final ? "Status: controlled final report." : "Status: draft report; technical review and approval are required before controlled use."), para(`Validation: ${String(diagnostics.filter((item) => item.severity === "ERROR").length)} errors and ${String(diagnostics.filter((item) => item.severity === "WARNING").length)} warnings.`), heading("Executive Summary", HeadingLevel.HEADING_1), para(mef.praScope), para(mef.documentation.riskInsights), para(mef.documentation.uncertaintySummary), heading("Analysis Process", HeadingLevel.HEADING_1), para(mef.documentation.overallProcessDescription)];
  for (const section of sections(mef)) { output.push(heading(section.title, HeadingLevel.HEADING_1), para(section.description)); if (section.records.length === 0) output.push(para("No records.")); for (const record of section.records) output.push(...recordBlocks(record)); }
  output.push(heading("Standard Conformance Matrix", HeadingLevel.HEADING_1), table(["SR", "Requirement", "Stage", "Status", "Satisfied by", "Evidence"], mef.conformanceMatrix.map((item) => [item.sr, EXTERNAL_FLOOD_PRA_SR_CATALOG[item.sr]?.description ?? "", item.applicableToStage.join("; "), item.status.replace(/_/g, " "), item.satisfiedByElementPaths.join("; "), item.evidence])));
  return output;
}
export async function generateExternalFloodPraReport(mef: ExternalFloodPRA, final: boolean): Promise<void> { const blob = await Packer.toBlob(new Document({ sections: [{ children: buildChildren(mef, final) }] })); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — External Flood PRA${final ? "" : " (draft)"}.docx`; link.click(); URL.revokeObjectURL(link.href); }
export function downloadExternalFloodPraJson(mef: ExternalFloodPRA): void { const blob = new Blob([JSON.stringify(mef, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — External Flood PRA.json`; link.click(); URL.revokeObjectURL(link.href); }
