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
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { formatRange, formatDuration, formatFrequency } from "./posSelectors";

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

function frequencyValue(f: number | { value: number }): number {
  return typeof f === "number" ? f : f.value;
}

function buildChildren(a: PlantOperatingStatesAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";

  out.push(
    new Paragraph({
      children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Preliminary Plant Operating State Analysis", size: 28, color: "4C4452" })],
      spacing: { after: 120 },
    }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(
    para(
      `This document presents the preliminary Plant Operating State (POS) analysis for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage to support the design certification submittal. ${a.plantOperatingStates.length} plant operating states across ${a.plantEvolutions.length} plant evolutions have been defined, characterised, and reviewed for completeness against the ${ccLabel} capability target.`,
    ),
  );

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other documents", HeadingLevel.HEADING_2));
  out.push(para(a.documentation.praTaskInterfaces));
  out.push(heading("Document layout", HeadingLevel.HEADING_2));
  out.push(para("This report follows the OpenPRA POS template: evolutions, operating states, interviews, screening and grouping, frequencies and durations, decay heat, and references."));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(a.plantRepresentationAccuracy.basis));

  out.push(heading("Assumptions and limitations", HeadingLevel.HEADING_1));
  out.push(para("Pre-operational assumptions logged with planned closure actions:"));
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

  out.push(heading("Identify plant operating states and evolutions", HeadingLevel.HEADING_1));
  out.push(heading("Plant evolutions", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["ID", "Evolution", "Type", "States"],
      a.plantEvolutions.map((e) => [e.uuid, e.name, e.type.split("_").join(" ").toLowerCase(), String(e.plantOperatingStateIds.length)]),
    ),
  );
  out.push(heading("Plant operating states", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["ID", "State", "Mode", "Coolant T", "Power", "Mean duration", "Entry frequency"],
      a.plantOperatingStates.map((s) => [
        s.uuid,
        s.name,
        s.operatingMode,
        formatRange(s.rcsParameters.reactorCoolantTemperature),
        formatRange(s.rcsParameters.powerLevel),
        formatDuration(s.meanDurationHours),
        formatFrequency(frequencyValue(s.meanEntryFrequency)),
      ]),
    ),
  );
  out.push(heading("Interviews", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Date", "Method", "Personnel", "Findings"],
      (a.interviewRecords ?? []).map((iv) => [iv.date, iv.method, iv.personnelRoles.join(", "), iv.findings]),
    ),
  );

  out.push(heading("Screening and grouping plant operating states", HeadingLevel.HEADING_1));
  out.push(heading("Screening plant operating states", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["State", "Decision", "Justification"],
      a.screeningRecords.map((r) => [r.posId, r.retained ? "Retained" : "Screened out", r.justification]),
    ),
  );
  out.push(heading("Grouping plant operating states", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["Group", "Members", "Bounding characteristic", "Total duration"],
      (a.plantOperatingStateGroups ?? []).map((g) => [
        g.name,
        g.memberPosIds.join(", "),
        g.boundingCharacteristics.join("; "),
        formatDuration(g.summedDurationHours),
      ]),
    ),
  );

  out.push(heading("Plant operating state frequencies and durations", HeadingLevel.HEADING_1));
  out.push(heading("Frequencies and durations analysis", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["State", "Mean duration", "Entry frequency"],
      a.plantOperatingStates.map((s) => [s.uuid, formatDuration(s.meanDurationHours), formatFrequency(frequencyValue(s.meanEntryFrequency))]),
    ),
  );
  out.push(heading("Decay heat levels", HeadingLevel.HEADING_2));
  out.push(
    dataTable(
      ["State", "Time after shutdown (h)", "Decay-heat level", "Basis"],
      a.decayHeatCharacterizations.map((d) => [d.posId, String(d.timeAfterShutdownHours), formatRange(d.decayHeatLevel), d.basis]),
    ),
  );

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(
    dataTable(
      ["SR", "HLR", "Category", "Status", "Evidence"],
      a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
    ),
  );

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Generic-1 Design Basis Document — Rev 4"));
  out.push(bullet("OP-002 — Startup & shutdown procedure"));
  out.push(bullet("OP-014 — Refuelling sequence"));
  out.push(bullet("EOP-100 — Post-trip cooldown"));
  out.push(bullet("Vendor decay-heat curves (NR-2024-117)"));

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

function computePosReportToc(pos: PlantOperatingStatesAnalysis): TocEntry[] {
  const sections: { title: string; indent: 0 | 1; lines: number }[] = [
    { title: "Executive summary", indent: 0, lines: 3 + paraLines(pos.praScope) },

    { title: "Introduction", indent: 0, lines: 1 },
    { title: "Purpose", indent: 1, lines: paraLines(pos.documentation.processDescription) },
    { title: "Scope", indent: 1, lines: paraLines(pos.praScope) },
    { title: "Relationship to other documents", indent: 1, lines: paraLines(pos.documentation.praTaskInterfaces) },
    { title: "Document layout", indent: 1, lines: 3 },
    { title: "Quality assurance", indent: 1, lines: paraLines(pos.plantRepresentationAccuracy.basis) },

    { title: "Assumptions and limitations", indent: 0, lines: 1 + Math.max(1, (pos.preOperationalAssumptions ?? []).length) },
    { title: "Sources of model uncertainty", indent: 1, lines: tableLines(pos.modelUncertainty.uncertaintySources.length) },

    { title: "Identify plant operating states and evolutions", indent: 0, lines: 1 },
    { title: "Plant evolutions", indent: 1, lines: tableLines(pos.plantEvolutions.length) },
    { title: "Plant operating states", indent: 1, lines: tableLines(pos.plantOperatingStates.length) },
    { title: "Interviews", indent: 1, lines: tableLines((pos.interviewRecords ?? []).length) },

    { title: "Screening and grouping plant operating states", indent: 0, lines: 1 },
    { title: "Screening plant operating states", indent: 1, lines: tableLines(pos.screeningRecords.length) },
    { title: "Grouping plant operating states", indent: 1, lines: tableLines((pos.plantOperatingStateGroups ?? []).length) },

    { title: "Plant operating state frequencies and durations", indent: 0, lines: 1 },
    { title: "Frequencies and durations analysis", indent: 1, lines: tableLines(pos.plantOperatingStates.length) },
    { title: "Decay heat levels", indent: 1, lines: tableLines(pos.decayHeatCharacterizations.length) },

    { title: "Conformance summary", indent: 0, lines: tableLines(pos.conformanceMatrix.length) },

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

async function generatePosReport(pos: PlantOperatingStatesAnalysis, final: boolean): Promise<void> {
  const doc = new Document({
    sections: [{ children: buildChildren(pos, final) }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${pos.name} — POS Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generatePosReport, computePosReportToc, type TocEntry };
