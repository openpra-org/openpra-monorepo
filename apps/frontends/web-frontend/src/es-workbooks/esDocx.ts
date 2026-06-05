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
  const deps = (a.dependencyModels?.functionalDependencies ?? []).flatMap((m) => m.dependencies);

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Event Sequence Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Event Sequence (ES) analysis for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.eventSequences.length} event sequences across ${(a.eventTrees ?? []).length} event trees have been delineated and grouped into ${a.eventSequenceFamilies.length} sequence families against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other tasks", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.praTaskInterfaces));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(a.plantResponseAnalysisAccuracy.basis));

  out.push(heading("Scope & safety functions", HeadingLevel.HEADING_1));
  out.push(para(`Operating states in scope: ${a.scopeDefinition.plantOperatingStateIds.length}. Initiating events in scope: ${a.scopeDefinition.initiatingEventIds.length}.`));
  out.push(heading("Radioactive sources", HeadingLevel.HEADING_2));
  for (const s of a.scopeDefinition.radioactiveMaterialSources) out.push(bullet(s));
  out.push(heading("Radionuclide transport barriers", HeadingLevel.HEADING_2));
  for (const b of a.scopeDefinition.radionuclideBarriers) out.push(bullet(b));
  out.push(heading("Key safety functions", HeadingLevel.HEADING_2));
  for (const f of a.keySafetyFunctions) out.push(bullet(f));

  out.push(heading("Event sequences", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["ID", "Sequence", "Initiator", "State", "End state", "Release", "Family", "Mean freq"],
    a.eventSequences.map((s) => [s.uuid, s.name, s.initiatingEventId, s.plantOperatingStateId, endStateLabel(String(s.endState)), s.releaseCategoryId ?? "—", s.sequenceFamilyId ?? "—", fmtFreq(s.meanFrequency)]),
  ));

  out.push(heading("Dependencies", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Type", "Dependent", "Depends upon", "Importance"],
    deps.map((d) => [String(d.dependencyType), d.dependentElement, d.dependedUponElement, d.importanceLevel !== undefined ? String(d.importanceLevel) : "—"]),
  ));

  out.push(heading("End states & release categories", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Release category", "Sequences", "Mean freq", "Characteristics"],
    (a.releaseCategoryMappings ?? []).map((m) => [m.releaseCategoryId, String(m.eventSequenceIds.length), fmtFreq(m.meanFrequency), m.commonCharacteristics.join("; ")]),
  ));

  out.push(heading("Sequence families", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["ID", "Family", "End state", "Release", "Members", "Mean freq"],
    a.eventSequenceFamilies.map((f) => [f.uuid, f.name, endStateLabel(String(f.endState)), (f.releaseCategoryIds ?? []).join(", ") || "—", String(f.memberSequenceIds.length), fmtFreq(f.meanFrequency)]),
  ));

  out.push(heading("Screening", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Sequence", "Disposition", "Criterion", "Basis"],
    a.screeningRecords.map((r) => [r.sequenceId, r.retained ? "Retained" : "Screened out", r.criterion ?? "—", r.justification]),
  ));

  out.push(heading("Model uncertainty & assumptions", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Source", "Impact / treatment"],
    a.modelUncertainty.uncertaintySources.map((m) => [m.source, m.impact]),
  ));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Generic-1 event-sequence model package"));
  out.push(bullet("Plant-response T/H calculations (RELAP/SAS)"));
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
