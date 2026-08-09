import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { INTERNAL_FLOOD_PRA_SR_CATALOG, type InternalFloodAnalysisRecord, type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { validateInternalFloodPra } from "interfaces-mef-types/internal-flood/internal-flood-pra-validation";

type ReportBlock = Paragraph | Table;

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 });
}
function para(text: string): Paragraph { return new Paragraph({ children: [new TextRun(text.length > 0 ? text : "Not documented.")], spacing: { after: 110 } }); }
function bullet(text: string): Paragraph { return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 }, spacing: { after: 50 } }); }
function cell(text: string, header: boolean): TableCell { return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })], shading: header ? { fill: "E8F3F7" } : undefined }); }
function table(headers: string[], rows: string[][]): Table {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headers.map((item) => cell(item, true)) }), ...rows.map((row) => new TableRow({ children: row.map((item) => cell(item, false)) }))], borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "C8D7DC" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "C8D7DC" }, left: { style: BorderStyle.SINGLE, size: 1, color: "C8D7DC" }, right: { style: BorderStyle.SINGLE, size: 1, color: "C8D7DC" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E4ECEF" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E4ECEF" } } });
}
function value(item: unknown): string {
  if (Array.isArray(item)) return item.map((entry) => typeof entry === "object" ? JSON.stringify(entry) : String(entry)).join("; ");
  if (typeof item === "boolean") return item ? "Yes" : "No";
  if (item !== null && typeof item === "object") return JSON.stringify(item);
  return String(item ?? "");
}
function recordBlocks(record: InternalFloodAnalysisRecord): ReportBlock[] {
  const out: ReportBlock[] = [heading(`${record.code} — ${record.name}`, HeadingLevel.HEADING_3), para(`Status: ${record.status.replace(/_/g, " ")}. Owner: ${record.owner}.`), para(record.description), para(`Technical basis: ${record.basis}`)];
  const hidden = new Set(["uuid", "code", "name", "description", "basis", "owner", "status", "evidenceRefs", "relatedRefs", "assumptionRefs", "implementsSrs"]);
  const details = Object.entries(record as unknown as Record<string, unknown>).filter(([key, entry]) => !hidden.has(key) && entry !== undefined).map(([key, entry]) => [key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " "), value(entry)]);
  if (details.length > 0) out.push(table(["Attribute", "Value"], details));
  out.push(para(`Evidence: ${record.evidenceRefs.join("; ") || "None linked"}. Related records: ${record.relatedRefs.join("; ") || "None linked"}. Implements: ${record.implementsSrs.map((item) => item.sr).join("; ") || "No direct SR claim"}.`));
  for (const assumption of record.assumptionRefs) out.push(bullet(`Assumption: ${assumption}`));
  return out;
}

function reportSections(mef: InternalFloodPRA): Array<{ title: string; description: string; records: InternalFloodAnalysisRecord[] }> {
  return [
    { title: "Applications", description: "Intended decision uses and risk metrics.", records: mef.applications },
    { title: "Evidence Register", description: "Controlled analysis inputs and applicability.", records: mef.evidenceRegister },
    { title: "FLPP — Analysis Boundary", description: mef.plantPartitioning.documentation.processDescription, records: [mef.plantPartitioning.analysisBoundary] },
    { title: "FLPP — Flood Areas", description: mef.plantPartitioning.documentation.resultsDescription, records: mef.plantPartitioning.floodAreas },
    { title: "FLPP — Coverage and Investigations", description: "Coverage, field confirmation, uncertainty, and pre-operational assumptions.", records: [...mef.plantPartitioning.coverageChecks, ...mef.plantPartitioning.investigations, ...mef.plantPartitioning.modelUncertainties, ...mef.plantPartitioning.preOperationalAssumptions] },
    { title: "FLSO — Flood Sources", description: mef.sourcesIdentificationAndCharacterization.documentation.processDescription, records: mef.sourcesIdentificationAndCharacterization.sources },
    { title: "FLSO — Failure and Release Characterization", description: mef.sourcesIdentificationAndCharacterization.documentation.resultsDescription, records: [...mef.sourcesIdentificationAndCharacterization.failureMechanisms, ...mef.sourcesIdentificationAndCharacterization.releaseCharacterizations] },
    { title: "FLSN — Propagation and Mitigation", description: mef.scenariosDevelopment.documentation.processDescription, records: [...mef.scenariosDevelopment.propagationPaths, ...mef.scenariosDevelopment.mitigationFeatures] },
    { title: "FLSN — Susceptibility, Hydraulics, and Scenarios", description: mef.scenariosDevelopment.documentation.resultsDescription, records: [...mef.scenariosDevelopment.sscSusceptibilities, ...mef.scenariosDevelopment.hydraulicCalculations, ...mef.scenariosDevelopment.floodScenarios] },
    { title: "FLEV — Initiating Events and Frequencies", description: mef.initiatingEvents.documentation.processDescription, records: [...mef.initiatingEvents.scenarioGroups, ...mef.initiatingEvents.initiatingEvents, ...mef.initiatingEvents.frequencyDataSets, ...mef.initiatingEvents.mitigationFailureProbabilities, ...mef.initiatingEvents.frequencyEstimates] },
    { title: "FLPR — Plant Response", description: mef.plantResponseModel.documentation.processDescription, records: [...mef.plantResponseModel.eventSequenceModels, ...mef.plantResponseModel.systemModelModifications, ...mef.plantResponseModel.successCriteria, ...mef.plantResponseModel.missionTimeAssessments, ...mef.plantResponseModel.plantResponseResults] },
    { title: "FLHR — Human Reliability", description: mef.humanReliabilityAnalysis.documentation.processDescription, records: [...mef.humanReliabilityAnalysis.humanActions, ...mef.humanReliabilityAnalysis.humanFailureEvents, ...mef.humanReliabilityAnalysis.performanceContexts, ...mef.humanReliabilityAnalysis.timingAssessments, ...mef.humanReliabilityAnalysis.hepEstimates, ...mef.humanReliabilityAnalysis.dependencyGroups] },
    { title: "FLESQ — Event Sequence Quantification", description: mef.eventSequenceQuantification.documentation.processDescription, records: [...mef.eventSequenceQuantification.quantificationRuns, ...mef.eventSequenceQuantification.eventSequenceFamilyResults, ...mef.eventSequenceQuantification.dependencies, ...mef.eventSequenceQuantification.riskContributors, ...mef.eventSequenceQuantification.uncertaintyResults, ...mef.eventSequenceQuantification.sensitivityStudies, ...mef.eventSequenceQuantification.traceability] },
    { title: "Risk Interpretation", description: "Risk insights, refinements, and stability iterations.", records: [...mef.riskInterpretation.riskInsights, ...mef.riskInterpretation.refinementActions, ...mef.riskInterpretation.quantificationIterations] },
    { title: "Risk Integration and Controlled Baseline", description: "Controlled results, decisions, traceability, and released baseline.", records: [...mef.riskIntegrationBaseline.results, ...mef.riskIntegrationBaseline.decisions, ...mef.riskIntegrationBaseline.traceabilityPaths, ...mef.riskIntegrationBaseline.controlledBaselines] },
    { title: "Workflow and Approval", description: "Draft, review, and approval records.", records: [...mef.workflow.reportSections, ...mef.workflow.draftQualityChecks, ...mef.workflow.reviewAssignments, ...mef.workflow.reviewFindings, ...mef.workflow.approvalReadiness, ...mef.workflow.approvalSignatures] },
  ];
}
function buildChildren(mef: InternalFloodPRA, final: boolean): ReportBlock[] {
  const diagnostics = validateInternalFloodPra(mef);
  const dispositioned = mef.conformanceMatrix.filter((row) => row.status === "MET" || row.status === "NOT_APPLICABLE").length;
  const site = mef.metadata.plantIdentity;
  const out: ReportBlock[] = [
    new Paragraph({ children: [new TextRun({ text: mef.name, bold: true, size: 48, color: "284B59" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: "Internal Flood Probabilistic Risk Assessment", size: 28, color: "4B6975" })], spacing: { after: 160 } }),
    para(`Plant: ${site?.name ?? "Not specified"}. Reactor type: ${site?.reactorType ?? "Not specified"}. Plant stage: ${mef.plantStage.replace(/_/g, " ")}. Model version: ${mef.version}.`),
    para(final ? "Status: controlled final report." : "Status: draft report; technical review and approval are required before controlled use."),
    para(`Conformance disposition: ${String(dispositioned)} of ${String(mef.conformanceMatrix.length)} supporting requirements. Validation: ${String(diagnostics.filter((item) => item.severity === "ERROR").length)} errors and ${String(diagnostics.filter((item) => item.severity === "WARNING").length)} warnings.`),
    heading("Executive Summary", HeadingLevel.HEADING_1), para(mef.praScope), para(mef.documentation.riskInsights), para(mef.documentation.uncertaintySummary),
    heading("Analysis Process", HeadingLevel.HEADING_1), para(mef.documentation.overallProcessDescription), para(mef.documentation.configurationControlDescription),
  ];
  for (const limitation of mef.metadata.limitations) out.push(bullet(limitation));
  for (const section of reportSections(mef)) {
    out.push(heading(section.title, HeadingLevel.HEADING_1), para(section.description));
    if (section.records.length === 0) out.push(para("No records."));
    for (const record of section.records) out.push(...recordBlocks(record));
  }
  out.push(heading("Standard Conformance Matrix", HeadingLevel.HEADING_1));
  out.push(table(["SR", "Requirement", "Stage", "Status", "Satisfied by", "Evidence"], mef.conformanceMatrix.map((item) => [item.sr, INTERNAL_FLOOD_PRA_SR_CATALOG[item.sr]?.description ?? "", item.applicableToStage.join("; "), item.status.replace(/_/g, " "), item.satisfiedByElementPaths.join("; "), item.evidence])));
  out.push(heading("Supporting Documents", HeadingLevel.HEADING_1));
  for (const reference of mef.documentation.supportingDocumentRefs) out.push(bullet(reference));
  return out;
}
export async function generateInternalFloodPraReport(mef: InternalFloodPRA, final: boolean): Promise<void> {
  const report = new Document({ sections: [{ children: buildChildren(mef, final) }] });
  const blob = await Packer.toBlob(report);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${mef.name} — Internal Flood PRA${final ? "" : " (draft)"}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
export function downloadInternalFloodPraJson(mef: InternalFloodPRA): void {
  const blob = new Blob([JSON.stringify(mef, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${mef.name} — Internal Flood PRA.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
