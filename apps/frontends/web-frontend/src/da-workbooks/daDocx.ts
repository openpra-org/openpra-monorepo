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
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 });
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

function val(v: number | undefined): string {
  return v === undefined ? "—" : v.toExponential(1).replace("e", "E");
}

const TYPE_LABELS: Record<string, string> = {
  FREQUENCY: "Frequency",
  PROBABILITY: "Demand probability",
  UNAVAILABILITY: "Unavailability",
  OTHER: "Failure rate",
  CCF_PARAMETER: "CCF parameter",
  HUMAN_ERROR_PROBABILITY: "HEP",
};

const APPROACH_LABELS: Record<string, string> = {
  PLANT_SPECIFIC: "Plant-specific",
  TECHNOLOGY_SPECIFIC: "Technology-specific",
  GENERIC: "Generic",
  REALISTIC_COMBINED: "Realistic combined",
  SIMILAR_EQUIPMENT_ADJUSTED: "Similar-adjusted",
};

function buildChildren(a: DataAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const params = a.parameters;
  const boundaries = a.componentBoundaries;
  const sources = a.externalDataSources ?? [];
  const ccfs = a.ccfParameterEstimations ?? [];

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Data Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Data Analysis (DA) for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${params.length} parameters, ${boundaries.length} component boundaries and ${ccfs.length} common-cause parameter estimations have been recorded against the ${ccLabel} capability target, each carrying a pedigree on the evidence ladder.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, scope & relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(a.praScope));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality assurance & freeze date", HeadingLevel.HEADING_2));
  out.push(para(doc.parameterEstimatesWithUncertainty));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Methodologies", HeadingLevel.HEADING_1));
  out.push(heading("Component failure models & parameters", HeadingLevel.HEADING_2));
  out.push(para(doc.basicEventProbabilityModels));
  out.push(heading("Common-cause failure models", HeadingLevel.HEADING_2));
  out.push(para(doc.ccfParameterBasis));
  out.push(heading("Testing & maintenance models", HeadingLevel.HEADING_2));
  out.push(para(doc.unavailabilityTreatment));
  out.push(heading("Bayesian estimation", HeadingLevel.HEADING_2));
  out.push(para(doc.bayesianPriorRationales));

  out.push(heading("Component identification in systems", HeadingLevel.HEADING_1));
  out.push(para(doc.systemComponentBoundaries));
  out.push(dataTable(["Boundary", "System", "Included", "Basis"], boundaries.map((b) => [b.name, b.systemId, b.includedItems.join("; "), b.boundaryBasis])));

  out.push(heading("Basic event type codes", HeadingLevel.HEADING_1));
  out.push(dataTable(["Basic event", "Parameter", "Type", "Pedigree"], params.map((p) => [p.basicEventRef ?? "—", p.name, TYPE_LABELS[p.parameterType] ?? p.parameterType, p.estimationApproach !== undefined ? (APPROACH_LABELS[p.estimationApproach] ?? p.estimationApproach) : "—"])));

  out.push(heading("Data sources (generic · design · expert)", HeadingLevel.HEADING_1));
  out.push(para(doc.genericParameterSources));
  out.push(dataTable(["Source", "Type", "Period"], sources.length > 0 ? sources.map((s) => [s.name, s.sourceType, `${s.timePeriod.start} to ${s.timePeriod.end}`]) : [["None", "—", "—"]]));

  out.push(heading("Data updating process", HeadingLevel.HEADING_1));
  out.push(para(doc.bayesianPriorRationales));
  out.push(para(doc.multiPosGenericUse));

  out.push(heading("Testing & maintenance (with recovery)", HeadingLevel.HEADING_1));
  out.push(para(doc.demandAndExposureCounting));
  out.push(para(doc.repairAndRecoveryData));

  out.push(heading("Component failure data", HeadingLevel.HEADING_1));
  out.push(dataTable(["Parameter", "Type", "Value", "Risk-significant"], params.map((p) => [p.name, TYPE_LABELS[p.parameterType] ?? p.parameterType, val(p.value), p.isRiskSignificant === true ? "Yes" : "No"])));

  out.push(heading("Common-cause failure data", HeadingLevel.HEADING_1));
  out.push(para(doc.ccfParameterBasis));
  out.push(dataTable(["Group", "Model", "Parameters", "Source"], ccfs.length > 0 ? ccfs.map((c) => [c.dataSources?.[0]?.context ?? c.ccfGroupReference, c.modelType, Object.entries(c.parameters).map(([k, v]) => `${k}=${v}`).join("; "), c.parameterSource]) : [["None", "—", "—", "—"]]));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Systems Analysis basic-event list and boundaries"));
  out.push(bullet("Generic component reliability database"));
  out.push(bullet("Sodium-facility operating experience"));
  out.push(bullet("Common-cause failure parameter database"));
  out.push(bullet("Bayesian estimation method basis"));
  return out;
}

async function generateDaReport(da: DataAnalysis, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(da, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${da.name} — DA Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateDaReport };
