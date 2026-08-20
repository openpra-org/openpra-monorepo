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
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { INITIATOR_CATEGORIES, categoryById } from "./ieViewData";

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

const BASIS_LABEL: Record<string, string> = {
  OPERATING_DATA: "Operating data",
  GENERIC_DATA: "Generic data",
  SIMILAR_PLANT_DATA: "Similar-plant data",
  DESIGN_BASED: "Design-based",
  FAULT_TREE: "Fault tree",
};

function freqValue(f: Frequency | FrequencyWithDistribution): number {
  return typeof f === "number" ? f : f.value;
}

function fmtFreq(v: number): string {
  if (!isFinite(v) || v <= 0) return "—";
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / Math.pow(10, exp);
  const sign = exp < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
}

function targetName(a: InitiatingEventsAnalysis, id: string): string {
  const g = a.initiatingEventGroups.find((x) => x.uuid === id);
  if (g !== undefined) return `${g.uuid} ${g.name}`;
  const i = a.initiators.find((x) => x.uuid === id);
  return i !== undefined ? `${i.uuid} ${i.name}` : id;
}

function references(a: InitiatingEventsAnalysis): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of a.searchMethods ?? []) {
    for (const d of m.supportingDocuments) {
      if (!seen.has(d)) {
        seen.add(d);
        out.push(d);
      }
    }
  }
  return out;
}

function buildChildren(a: InitiatingEventsAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";

  out.push(
    new Paragraph({
      children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Preliminary Initiating Event Analysis", size: 28, color: "4C4452" })],
      spacing: { after: 120 },
    }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(
    para(
      `This document presents the preliminary Initiating Event (IE) analysis for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.initiators.length} initiating events were identified across the challenge categories, organised into ${a.initiatingEventGroups.length} initiating-event groups, screened, and quantified against the ${ccLabel} capability target.`,
    ),
  );
  if (a.documentation.resultsSummary.length > 0) out.push(para(a.documentation.resultsSummary));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other documents", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.praTaskInterfaces));
  out.push(heading("Document layout", HeadingLevel.HEADING_2));
  out.push(para("This report follows the OpenPRA IE template: identification, completeness, screening and grouping, quantification, conformance, and references."));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(a.plantRepresentationAccuracy.basis));

  out.push(heading("Assumptions and limitations", HeadingLevel.HEADING_1));
  for (const pa of a.preOperationalAssumptions ?? []) {
    out.push(bullet(`${pa.description} (risk impact: ${pa.riskImpact}). Closure: ${pa.closureBasis}`));
  }
  out.push(heading("Sources of model uncertainty", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Source", "Impact / treatment"],
      a.modelUncertainty.uncertaintySources.map((m) => [m.source, m.impact]),
    ),
  );

  out.push(heading("Initiating-event identification", HeadingLevel.HEADING_1));
  out.push(heading("Challenge categories", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Category", "Initiators"],
      INITIATOR_CATEGORIES.map((c) => [c.label, String(a.initiators.filter((i) => i.category === c.id).length)]).filter((r) => r[1] !== "0"),
    ),
  );
  out.push(heading("Search methods", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Method", "Role", "Coverage"],
      (a.searchMethods ?? []).map((m) => [m.name, m.role, m.coverageCategories.map((c) => categoryById(c)?.label ?? c).join(", ")]),
    ),
  );
  out.push(heading("Identified initiating events", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["ID", "Initiator", "Category", "Disposition"],
      a.initiators.map((i) => [i.uuid, i.name, categoryById(i.category)?.label ?? i.category, i.screeningStatus]),
    ),
  );

  out.push(heading("Completeness of the search", HeadingLevel.HEADING_1));
  out.push(para(a.documentation.completenessAssessment));

  out.push(heading("Screening and grouping of initiating events", HeadingLevel.HEADING_1));
  out.push(heading("Screening of initiating events", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.screeningProcessAndBasis));
  out.push(
    dataTable(
      ["Target", "Decision", "Criterion", "Justification"],
      a.screeningRecords.map((r) => [targetName(a, r.initiatorOrGroupId), r.retained ? "Retained" : "Screened out", r.criterion ?? "—", r.justification]),
    ),
  );
  out.push(heading("Grouping of initiating events", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.groupingProcessAndBasis));
  out.push(
    dataTable(
      ["Group", "Members", "Bounding", "Basis"],
      a.initiatingEventGroups.map((g) => [g.name, g.memberInitiatorIds.join(", "), g.boundingInitiatorId, g.groupingBasis]),
    ),
  );

  out.push(heading("Initiating-event quantification", HeadingLevel.HEADING_1));
  out.push(heading("Frequency quantification methodology", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.frequencyDerivation));
  out.push(para(a.documentation.quantificationApproach));
  out.push(heading("Initiating-event group frequencies", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Target", "Mean frequency (per plant-yr)", "Basis"],
      a.quantifications.map((q) => [targetName(a, q.initiatorOrGroupId), fmtFreq(freqValue(q.meanFrequency)), BASIS_LABEL[q.basis] ?? q.basis]),
    ),
  );

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(
    dataTable(
      ["SR", "HLR", "Category", "Status", "Evidence"],
      a.conformanceMatrix.filter((c) => c.applicableToStage.includes(a.plantStage)).map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
    ),
  );

  out.push(heading("References", HeadingLevel.HEADING_1));
  const refs = references(a);
  if (refs.length === 0) {
    out.push(para("No external references recorded."));
  } else {
    for (const r of refs) out.push(bullet(r));
  }

  return out;
}

interface TocEntry {
  title: string;
  indent: 0 | 1;
  page: number;
}

const LINES_PER_PAGE = 38;

function paraLines(text: string | undefined): number {
  if (text === undefined || text.length === 0) return 1;
  return Math.max(1, Math.ceil(text.length / 90));
}

function tableLines(rowCount: number): number {
  return 1 + Math.max(1, rowCount);
}

function computeIeReportToc(ie: InitiatingEventsAnalysis): TocEntry[] {
  const sections: { title: string; indent: 0 | 1; lines: number }[] = [
    { title: "Executive summary", indent: 0, lines: 4 + paraLines(ie.documentation.resultsSummary) },

    { title: "Introduction", indent: 0, lines: 1 },
    { title: "Purpose", indent: 1, lines: paraLines(ie.documentation.processDescription) },
    { title: "Scope", indent: 1, lines: paraLines(ie.praScope) },
    { title: "Relationship to other documents", indent: 1, lines: paraLines(ie.documentation.praTaskInterfaces) },
    { title: "Document layout", indent: 1, lines: 3 },
    { title: "Quality assurance", indent: 1, lines: paraLines(ie.plantRepresentationAccuracy.basis) },

    { title: "Assumptions and limitations", indent: 0, lines: 1 + Math.max(1, (ie.preOperationalAssumptions ?? []).length) },
    { title: "Sources of model uncertainty", indent: 1, lines: tableLines(ie.modelUncertainty.uncertaintySources.length) },

    { title: "Initiating-event identification", indent: 0, lines: 1 },
    { title: "Challenge categories", indent: 1, lines: tableLines(INITIATOR_CATEGORIES.length) },
    { title: "Search methods", indent: 1, lines: tableLines((ie.searchMethods ?? []).length) },
    { title: "Identified initiating events", indent: 1, lines: tableLines(ie.initiators.length) },

    { title: "Completeness of the search", indent: 0, lines: paraLines(ie.documentation.completenessAssessment) },

    { title: "Screening and grouping of initiating events", indent: 0, lines: 1 },
    { title: "Screening of initiating events", indent: 1, lines: tableLines(ie.screeningRecords.length) },
    { title: "Grouping of initiating events", indent: 1, lines: tableLines(ie.initiatingEventGroups.length) },

    { title: "Initiating-event quantification", indent: 0, lines: 1 },
    { title: "Frequency quantification methodology", indent: 1, lines: 4 },
    { title: "Initiating-event group frequencies", indent: 1, lines: tableLines(ie.quantifications.length) },

    { title: "Conformance summary", indent: 0, lines: tableLines(ie.conformanceMatrix.filter((c) => c.applicableToStage.includes(ie.plantStage)).length) },

    { title: "References", indent: 0, lines: 5 },
  ];

  const COVER_AND_TOC_PAGES = 1;
  const out: TocEntry[] = [];
  let page = COVER_AND_TOC_PAGES + 1;
  let cursorInPage = 0;
  let first = true;
  for (const s of sections) {
    if (s.indent === 0) {
      if (!first) {
        page += 1;
        cursorInPage = 0;
      }
      first = false;
    } else if (cursorInPage >= LINES_PER_PAGE) {
      page += 1;
      cursorInPage = 0;
    }
    out.push({ title: s.title, indent: s.indent, page });
    cursorInPage += s.lines;
  }
  return out;
}

async function generateIeReport(ie: InitiatingEventsAnalysis, final: boolean): Promise<void> {
  const doc = new Document({
    sections: [{ children: buildChildren(ie, final) }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ie.name} — IE Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateIeReport, computeIeReportToc, type TocEntry };
