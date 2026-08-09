import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { INTERNAL_FIRE_PRA_SR_CATALOG, type InternalFireAnalysisRecord, type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { validateInternalFirePra } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";

type ReportBlock = Paragraph | Table;
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph { return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 }); }
function para(text: string): Paragraph { return new Paragraph({ children: [new TextRun(text.length > 0 ? text : "Not documented.")], spacing: { after: 110 } }); }
function cell(text: string, header: boolean): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })], shading: header ? { fill: "F7EDE7" } : undefined }); }
function table(headers: string[], rows: string[][]): Table { return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headers.map((item) => cell(item, true)) }), ...rows.map((row) => new TableRow({ children: row.map((item) => cell(item, false)) }))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D7C7BF" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7C7BF" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D7C7BF" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D7C7BF" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "ECE2DD" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "ECE2DD" } } }); }
function value(item: unknown): string { if (Array.isArray(item)) return item.map(value).join("; "); if (typeof item === "boolean") return item ? "Yes" : "No"; if (item !== null && typeof item === "object") return JSON.stringify(item); return String(item ?? ""); }
function recordsIn(value: unknown): InternalFireAnalysisRecord[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(recordsIn);
  const item = value as Record<string, unknown>;
  if (typeof item.uuid === "string" && typeof item.code === "string" && typeof item.status === "string") return [value as InternalFireAnalysisRecord];
  return Object.values(item).flatMap(recordsIn);
}
function recordBlocks(record: InternalFireAnalysisRecord): ReportBlock[] {
  const out: ReportBlock[] = [heading(`${record.code} — ${record.name}`, HeadingLevel.HEADING_3), para(`Status: ${record.status.replace(/_/g, " ")}. Owner: ${record.owner}.`), para(record.description), para(`Technical basis: ${record.basis}`)];
  const hidden = new Set(["uuid", "code", "name", "description", "basis", "owner", "status", "evidenceRefs", "relatedRefs", "assumptionRefs", "implementsSrs"]);
  const details = Object.entries(record as unknown as Record<string, unknown>).filter(([key, entry]) => !hidden.has(key) && entry !== undefined).map(([key, entry]) => [key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " "), value(entry)]);
  if (details.length > 0) out.push(table(["Attribute", "Value"], details));
  out.push(para(`Evidence: ${record.evidenceRefs.join("; ") || "None linked"}. Related records: ${record.relatedRefs.join("; ") || "None linked"}.`));
  return out;
}
function sections(mef: InternalFirePRA): Array<{ title: string; description: string; records: InternalFireAnalysisRecord[] }> {
  return [
    { title: "Applications and Evidence", description: mef.praScope, records: [...mef.applications, ...mef.evidenceRegister] },
    { title: "FPP — Plant Boundary and Partitioning", description: mef.plantBoundaryAndPartitioning.documentation.processDescription, records: recordsIn(mef.plantBoundaryAndPartitioning) },
    { title: "FES — Equipment Selection", description: mef.equipmentSelection.documentation.processDescription, records: recordsIn(mef.equipmentSelection) },
    { title: "FCS — Cable Selection and Location", description: mef.cableSelectionAndLocation.documentation.processDescription, records: recordsIn(mef.cableSelectionAndLocation) },
    { title: "FQLS — Qualitative Screening", description: mef.qualitativeScreening.documentation.processDescription, records: recordsIn(mef.qualitativeScreening) },
    { title: "FPRM — Plant Response Model", description: mef.plantResponseModel.documentation.processDescription, records: recordsIn(mef.plantResponseModel) },
    { title: "FSS — Fire Scenario Selection and Analysis", description: mef.scenarioSelectionAndAnalysis.documentation.processDescription, records: recordsIn(mef.scenarioSelectionAndAnalysis) },
    { title: "FIGN — Ignition Frequency", description: mef.ignitionFrequency.documentation.processDescription, records: recordsIn(mef.ignitionFrequency) },
    { title: "FCF — Circuit Failure Analysis", description: mef.circuitFailureAnalysis.documentation.processDescription, records: recordsIn(mef.circuitFailureAnalysis) },
    { title: "FHR — Human Reliability Analysis", description: mef.humanReliabilityAnalysis.documentation.processDescription, records: recordsIn(mef.humanReliabilityAnalysis) },
    { title: "FESQ — Event Sequence Quantification", description: mef.eventSequenceQuantification.documentation.processDescription, records: recordsIn(mef.eventSequenceQuantification) },
    { title: "Risk Interpretation", description: mef.documentation.riskInsights, records: recordsIn(mef.riskInterpretation) },
    { title: "Risk Integration and Controlled Baseline", description: mef.documentation.configurationControlDescription, records: recordsIn(mef.riskIntegrationBaseline) },
    { title: "Workflow and Approval", description: "Controlled draft, review, approval, and release records.", records: recordsIn(mef.workflow) },
  ];
}
function buildChildren(mef: InternalFirePRA, final: boolean): ReportBlock[] {
  const diagnostics = validateInternalFirePra(mef);
  const site = mef.metadata.plantIdentity;
  const out: ReportBlock[] = [new Paragraph({ children: [new TextRun({ text: mef.name, bold: true, size: 48, color: "74351F" })], spacing: { after: 80 } }), new Paragraph({ children: [new TextRun({ text: "Internal Fire Probabilistic Risk Assessment", size: 28, color: "74584D" })], spacing: { after: 160 } }), para(`Plant: ${site?.name ?? "Not specified"}. Reactor type: ${site?.reactorType ?? "Not specified"}. Plant stage: ${mef.plantStage.replace(/_/g, " ")}. Model version: ${mef.version}.`), para(final ? "Status: controlled final report." : "Status: draft report; technical review and approval are required before controlled use."), para(`Validation: ${String(diagnostics.filter((item) => item.severity === "ERROR").length)} errors and ${String(diagnostics.filter((item) => item.severity === "WARNING").length)} warnings.`), heading("Executive Summary", HeadingLevel.HEADING_1), para(mef.praScope), para(mef.documentation.riskInsights), para(mef.documentation.uncertaintySummary), heading("Analysis Process", HeadingLevel.HEADING_1), para(mef.documentation.overallProcessDescription)];
  for (const section of sections(mef)) { out.push(heading(section.title, HeadingLevel.HEADING_1), para(section.description)); if (section.records.length === 0) out.push(para("No records.")); for (const record of section.records) out.push(...recordBlocks(record)); }
  out.push(heading("Standard Conformance Matrix", HeadingLevel.HEADING_1), table(["SR", "Requirement", "Stage", "Status", "Satisfied by", "Evidence"], mef.conformanceMatrix.map((item) => [item.sr, INTERNAL_FIRE_PRA_SR_CATALOG[item.sr]?.description ?? "", item.applicableToStage.join("; "), item.status.replace(/_/g, " "), item.satisfiedByElementPaths.join("; "), item.evidence])));
  return out;
}
export async function generateInternalFirePraReport(mef: InternalFirePRA, final: boolean): Promise<void> { const blob = await Packer.toBlob(new Document({ sections: [{ children: buildChildren(mef, final) }] })); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — Internal Fire PRA${final ? "" : " (draft)"}.docx`; link.click(); URL.revokeObjectURL(link.href); }
export function downloadInternalFirePraJson(mef: InternalFirePRA): void { const blob = new Blob([JSON.stringify(mef, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — Internal Fire PRA.json`; link.click(); URL.revokeObjectURL(link.href); }
