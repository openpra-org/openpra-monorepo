import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { ES_LBE_CLASSES } from "./esViewData";
import { lbeView } from "./esSelectors";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
    pageBreakBefore: level === HeadingLevel.HEADING_1,
  });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });
}

function cell(text: string, header: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 18 })] })],
    shading: header ? { fill: "F0E8FF" } : undefined,
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9CEE2" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EDE6F2" },
    },
  });
}

function freqValue(f: number | { value: number } | undefined): number | undefined {
  if (f === undefined) return undefined;
  return typeof f === "number" ? f : f.value;
}

function fmtFreq(f: number | { value: number } | undefined): string {
  const v = freqValue(f);
  return v === undefined ? "—" : `${v.toExponential(1).toUpperCase()}/yr`;
}

function endStateLabel(s: string): string {
  return s === "SUCCESSFUL_MITIGATION" ? "Safe stable state" : "Radionuclide release";
}

function buildChildren(a: EventSequenceAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const trees = a.eventTrees ?? [];
  const deps = (a.dependencyModels?.functionalDependencies ?? []).flatMap((m) => m.dependencies);
  const doc = a.documentation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Event Sequence Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Event Sequence (ES) analysis for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.eventSequences.length} event sequences across ${trees.length} event trees have been delineated and grouped into ${a.eventSequenceFamilies.length} sequence families against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other documents", HeadingLevel.HEADING_2));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Document layout", HeadingLevel.HEADING_2));
  out.push(para("This report covers the assumptions and limitations, the initiating events selected for analysis, event sequence development, event sequence analysis for each mode and state, and the preliminary point-estimate licensing basis events, followed by the supporting references."));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(a.plantResponseAnalysisAccuracy.basis));
  out.push(heading("Freeze date", HeadingLevel.HEADING_2));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Initiating events selected for ES analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.posInitiatorSequenceLinkage));
  out.push(dataTable(
    ["Initiating event", "Event tree", "Operating state", "Mission time"],
    trees.map((t) => [t.initiatingEventId, t.name, t.plantOperatingStateId ?? "—", `${t.missionTime ?? "—"} ${t.missionTimeUnits ?? ""}`.trim()]),
  ));

  out.push(heading("Event sequence development", HeadingLevel.HEADING_1));
  out.push(heading("General framework of ES models", HeadingLevel.HEADING_2));
  out.push(para(doc.sequenceDelineation));
  out.push(heading("Event sequence end states", HeadingLevel.HEADING_2));
  out.push(para(doc.endStateAndReleaseCategoryDefinitions));
  out.push(para(doc.intermediateEndStatesAndTransfers));
  out.push(heading("Implementation of the framework", HeadingLevel.HEADING_2));
  out.push(para(doc.deterministicAnalysesUsed));
  out.push(para(doc.operatorActionsRepresentation));
  out.push(heading("Response of plant systems & structures", HeadingLevel.HEADING_2));
  out.push(para(doc.plantResponseAnalysisBasis));
  out.push(dataTable(
    ["Event tree", "Initiator", "State", "Mission time", "Sequences"],
    trees.map((t) => [t.name, t.initiatingEventId, t.plantOperatingStateId ?? "—", `${t.missionTime ?? "—"} ${t.missionTimeUnits ?? ""}`.trim(), String(Object.keys(t.sequences).length)]),
  ));
  out.push(heading("Source term characteristics", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Release category", "Sequences", "Mean freq", "Characteristics"],
    (a.releaseCategoryMappings ?? []).map((m) => [m.releaseCategoryId, String(m.eventSequenceIds.length), fmtFreq(m.meanFrequency), m.commonCharacteristics.join("; ")]),
  ));
  out.push(heading("Event sequence development models", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["ID", "Sequence", "Initiator", "State", "End state", "Release", "Family", "Mean freq"],
    a.eventSequences.map((s) => [s.uuid, s.name, s.initiatingEventId, s.plantOperatingStateId, endStateLabel(String(s.endState)), s.releaseCategoryId ?? "—", s.sequenceFamilyId ?? "—", fmtFreq(s.meanFrequency)]),
  ));

  out.push(heading("Event sequence analysis for mode & state", HeadingLevel.HEADING_1));
  out.push(heading("Common elements (scope, success criteria, mitigation)", HeadingLevel.HEADING_2));
  out.push(para(`Operating states in scope: ${a.scopeDefinition.plantOperatingStateIds.length}. Initiating events in scope: ${a.scopeDefinition.initiatingEventIds.length}.`));
  out.push(para(doc.successCriteriaBases));
  out.push(para(doc.keySafetyFunctionsIdentification));
  for (const f of a.keySafetyFunctions) out.push(bullet(`${f.name} — ${f.description}`));
  out.push(dataTable(
    ["Event tree", "Initiator", "Safety design mitigation strategy"],
    trees.map((t) => [t.name, t.initiatingEventId, t.mitigationStrategy ?? "—"]),
  ));
  out.push(heading("Key assumptions & uncertainties", HeadingLevel.HEADING_2));
  out.push(para(doc.modelUncertaintySources));
  if (a.modelUncertainty.uncertaintySources.length > 0) {
    out.push(dataTable(
      ["Source", "Impact / treatment"],
      a.modelUncertainty.uncertaintySources.map((m) => [m.source, m.impact]),
    ));
  }
  out.push(heading("Event sequence quantification", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["ID", "Family", "End state", "Release", "Members", "Mean freq"],
    a.eventSequenceFamilies.map((f) => [f.uuid, f.name, endStateLabel(String(f.endState)), (f.releaseCategoryIds ?? []).join(", ") || "—", String(f.memberSequenceIds.length), fmtFreq(f.meanFrequency)]),
  ));
  out.push(dataTable(
    ["Sequence", "Disposition", "Criterion", "Basis"],
    a.screeningRecords.map((r) => [r.sequenceId, r.retained ? "Retained" : "Screened out", r.criterion ?? "—", r.justification]),
  ));
  out.push(heading("Event sequence models", HeadingLevel.HEADING_2));
  out.push(para(doc.dependencyTreatment));
  out.push(dataTable(
    ["Type", "Dependent", "Depends upon", "Importance"],
    deps.map((d) => [String(d.dependencyType), d.dependentElement, d.dependedUponElement, d.importanceLevel !== undefined ? String(d.importanceLevel) : "—"]),
  ));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("Preliminary point-estimate licensing basis events", HeadingLevel.HEADING_1));
  out.push(para("Each sequence family is placed into a preliminary licensing-basis-event class by its point-estimate frequency, pending the full ESQ uncertainty quantification."));
  out.push(dataTable(
    ["Family", "RC", "Point estimate", "Class"],
    lbeView(a).map((lbe) => [`${lbe.familyId}: ${lbe.name}`, lbe.releaseCategoryId ?? "Safe state", fmtFreq(lbe.meanFrequency), lbe.lbeClass !== undefined ? ES_LBE_CLASSES[lbe.lbeClass].label : "Below 5E-7 /yr"]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet(`${a.name} model package`));
  out.push(bullet("Plant-response thermal-hydraulic calculations"));
  out.push(bullet("Success-criteria workbook (linked)"));
  out.push(bullet("IE Workbook: groups & frequencies"));
  out.push(bullet("Dependency & CCF basis memo"));

  return out;
}

async function generateEsReport(es: EventSequenceAnalysis, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(es, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${es.name} — ES Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateEsReport };
