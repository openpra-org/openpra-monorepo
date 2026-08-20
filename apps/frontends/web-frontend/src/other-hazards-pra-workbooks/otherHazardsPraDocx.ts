import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { OTHER_HAZARDS_PRA_SR_CATALOG, type OtherHazardsAnalysisRecord, type OtherHazardsPRA } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { validateOtherHazardsPra } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";

type ReportBlock = Paragraph | Table;
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph { return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 }); }
function para(text: string): Paragraph { return new Paragraph({ children: [new TextRun(text.length > 0 ? text : "Not documented.")], spacing: { after: 110 } }); }
function cell(text: string, header: boolean): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })], shading: header ? { fill: "EDF5F4" } : undefined }); }
function table(headers: string[], rows: string[][]): Table { return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headers.map((item) => cell(item, true)) }), ...rows.map((row) => new TableRow({ children: row.map((item) => cell(item, false)) }))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, left: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, right: { style: BorderStyle.SINGLE, size: 1, color: "BFD1CF" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDE8E7" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDE8E7" } } }); }
function value(item: unknown): string { if (Array.isArray(item)) return item.map(value).join("; "); if (typeof item === "boolean") return item ? "Yes" : "No"; if (item !== null && typeof item === "object") return JSON.stringify(item); return String(item ?? ""); }
function recordsIn(input: unknown): OtherHazardsAnalysisRecord[] {
  if (input === null || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap(recordsIn);
  const item = input as Record<string, unknown>;
  if (typeof item.uuid === "string" && typeof item.code === "string" && typeof item.status === "string") return [input as OtherHazardsAnalysisRecord];
  return Object.values(item).flatMap(recordsIn);
}
function recordBlocks(record: OtherHazardsAnalysisRecord): ReportBlock[] {
  const output: ReportBlock[] = [heading(`${record.code} — ${record.name}`, HeadingLevel.HEADING_3), para(`Status: ${record.status.replace(/_/g, " ")}. Owner: ${record.owner}.`), para(record.description), para(`Technical basis: ${record.basis}`)];
  const hidden = new Set(["uuid", "code", "name", "description", "basis", "owner", "status", "evidenceRefs", "relatedRefs", "assumptionRefs", "implementsSrs"]);
  const details = Object.entries(record as unknown as Record<string, unknown>).filter(([key, entry]) => !hidden.has(key) && entry !== undefined).map(([key, entry]) => [key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " "), value(entry)]);
  if (details.length > 0) output.push(table(["Attribute", "Value"], details));
  output.push(para(`Evidence: ${record.evidenceRefs.join("; ") || "None linked"}. Related records: ${record.relatedRefs.join("; ") || "None linked"}.`));
  return output;
}
function sections(mef: OtherHazardsPRA): Array<{ title: string; description: string; records: OtherHazardsAnalysisRecord[] }> {
  return [
    { title: "Analysis Basis, Scope, and Interfaces", description: mef.documentation.analysisBasisSummary, records: recordsIn(mef.analysisBasis) },
    { title: "OHA — Controlled Site and Evidence Basis", description: mef.documentation.siteAndEvidenceSummary, records: recordsIn([mef.analysisBasis.evidenceRegister, mef.analysisBasis.siteAndRegionalData, mef.analysisBasis.designBasisRecords, mef.analysisBasis.operatingExperience]) },
    { title: "OHA — Retained Hazard Groups", description: mef.documentation.retainedHazardsSummary, records: recordsIn(mef.retainedHazardGroups) },
    { title: "OHA — Source and Effect Characterization", description: mef.documentation.sourceCharacterizationSummary, records: recordsIn(mef.hazardSourceCharacterization) },
    { title: "OHA — Hazard Frequency Analysis", description: mef.documentation.frequencyAnalysisSummary, records: recordsIn(mef.hazardFrequencyAnalysis) },
    { title: "OHA — Secondary and Combined Hazards", description: mef.documentation.secondaryHazardsSummary, records: recordsIn(mef.secondaryAndCombinedHazards) },
    { title: "OHA — Hazard Curves and Intervals", description: mef.documentation.hazardCurveSummary, records: recordsIn(mef.hazardCurveAnalysis) },
    { title: "OPR — Preliminary Plant Response and SSC Scope", description: mef.documentation.sscScopeSummary, records: recordsIn(mef.preliminaryPlantResponse) },
    { title: "OFR — Plant Investigation", description: mef.documentation.investigationSummary, records: recordsIn(mef.plantInvestigation) },
    { title: "OFR — SSC Screening and Fragility Basis", description: mef.documentation.fragilitySummary, records: recordsIn(mef.fragilityBasis) },
    { title: "OFR — SSC and Functional Fragility Analysis", description: mef.documentation.fragilitySummary, records: recordsIn(mef.fragilityAnalysis) },
    { title: "OPR — Initiating Events and Scenario Development", description: mef.documentation.scenarioSummary, records: recordsIn(mef.initiatingEventAndScenarioDevelopment) },
    { title: "OPR — Plant-Response Model", description: mef.documentation.plantResponseSummary, records: recordsIn(mef.plantResponseModel) },
    { title: "OPR — Human Reliability Analysis", description: mef.documentation.humanReliabilitySummary, records: recordsIn(mef.humanReliabilityAnalysis) },
    { title: "OPR — Event-Sequence Quantification", description: mef.documentation.quantificationSummary, records: recordsIn(mef.eventSequenceQuantification) },
    { title: "Uncertainty, Sensitivity, and Risk Interpretation", description: `${mef.documentation.uncertaintySummary}\n\n${mef.documentation.riskInsights}`, records: recordsIn([mef.integratedUncertainties, mef.riskInterpretation]) },
    { title: "Technical Closure and Peer-Review Readiness", description: mef.documentation.peerReviewScope, records: recordsIn(mef.technicalClosure) },
    { title: "Workflow and Approval", description: mef.documentation.configurationControlDescription, records: recordsIn(mef.workflow) },
  ];
}
function buildChildren(mef: OtherHazardsPRA, final: boolean): ReportBlock[] {
  const diagnostics = validateOtherHazardsPra(mef);
  const site = mef.metadata.plantIdentity;
  const output: ReportBlock[] = [new Paragraph({ children: [new TextRun({ text: mef.name, bold: true, size: 48, color: "1F5753" })], spacing: { after: 80 } }), new Paragraph({ children: [new TextRun({ text: "Other Hazards Probabilistic Risk Assessment", size: 28, color: "496F6C" })], spacing: { after: 160 } }), para(`Plant: ${site?.name ?? "Not specified"}. Reactor type: ${site?.reactorType ?? "Not specified"}. Plant stage: ${mef.plantStage.replace(/_/g, " ")}. Model version: ${mef.version}.`), para(final ? "Status: controlled final report." : "Status: draft report; technical review and approval are required before controlled use."), para(`Validation: ${String(diagnostics.filter((item) => item.severity === "ERROR").length)} errors and ${String(diagnostics.filter((item) => item.severity === "WARNING").length)} warnings.`), heading("Executive Summary", HeadingLevel.HEADING_1), para(mef.praScope), para(mef.documentation.riskInsights), para(mef.documentation.uncertaintySummary), heading("Analysis Process", HeadingLevel.HEADING_1), para(mef.documentation.overallProcessDescription)];
  for (const section of sections(mef)) { output.push(heading(section.title, HeadingLevel.HEADING_1), para(section.description)); if (section.records.length === 0) output.push(para("No records.")); for (const record of section.records) output.push(...recordBlocks(record)); }
  output.push(heading("Standard Conformance Matrix", HeadingLevel.HEADING_1), table(["SR", "Requirement", "Stage", "Status", "Satisfied by", "Evidence"], mef.conformanceMatrix.map((item) => [item.sr, OTHER_HAZARDS_PRA_SR_CATALOG[item.sr]?.description ?? "", item.applicableToStage.join("; "), item.status.replace(/_/g, " "), item.satisfiedByElementPaths.join("; "), item.evidence])));
  return output;
}
export async function generateOtherHazardsPraReport(mef: OtherHazardsPRA, final: boolean): Promise<void> { const blob = await Packer.toBlob(new Document({ sections: [{ children: buildChildren(mef, final) }] })); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — Other Hazards PRA${final ? "" : " (draft)"}.docx`; link.click(); URL.revokeObjectURL(link.href); }
export function downloadOtherHazardsPraJson(mef: OtherHazardsPRA): void { const blob = new Blob([JSON.stringify(mef, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${mef.name} — Other Hazards PRA.json`; link.click(); URL.revokeObjectURL(link.href); }
