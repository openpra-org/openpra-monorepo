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
import { CCF_METHOD_LABELS, CCF_MODEL_LABELS, CCF_TESTING_LABELS, EVIDENCE_KIND_LABELS, FREQUENCY_MODE_LABELS, INITIATOR_CATEGORY_LABELS, SENSITIVITY_KIND_LABELS, MAINTENANCE_KIND_LABELS, MAINTENANCE_METHOD_LABELS, RESTORATION_KIND_LABELS, RESTORATION_FROM_LABELS, SOURCE_ORIGIN_LABELS } from "./daViewData";
import { libraryCount } from "./daSourcing";
import { maintenanceEstimate, maintenanceParameters, restorationEstimate, restorationParameters } from "./daUnavailability";
import { ccfResult } from "./daCcf";
import { frequencyEstimate, frequencyParameters } from "./daFrequencies";
import { sensitivityResult } from "./daUncertainty";

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

function hours(v: number | undefined): string {
  return v === undefined ? "—" : String(Number(v.toPrecision(4)));
}

const TYPE_LABELS: Record<string, string> = {
  FREQUENCY: "Frequency",
  FAILURE_RATE: "Failure rate",
  PROBABILITY: "Demand probability",
  UNAVAILABILITY: "Unavailability",
  OTHER: "Other",
  CCF_PARAMETER: "CCF parameter",
  HUMAN_ERROR_PROBABILITY: "HEP",
};

function buildChildren(a: DataAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const params = a.parameters;
  const boundaries = a.componentBoundaries;
  const sources = a.sources ?? [];
  const elicitations = a.elicitations ?? [];
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
  const assumptions = a.preOperationalAssumptions ?? [];
  out.push(heading("Pre-operational assumptions", HeadingLevel.HEADING_2));
  out.push(dataTable(["Assumption", "Area", "Status", "Parameters", "How it closes"], assumptions.length > 0 ? assumptions.map((item) => [`${item.assumptionId} · ${item.description}`, item.influenceOnDefinition, item.status, item.affectedElementIds.join(", ") || "—", item.closureBasis || "—"]) : [["None", "—", "—", "—", "—"]]));
  const register = a.uncertaintyRegister ?? [];
  out.push(heading("Model uncertainty register", HeadingLevel.HEADING_2));
  out.push(dataTable(["Entry", "What is uncertain", "Impact", "Parameters", "Alternatives", "Key"], register.length > 0 ? register.map((source) => [source.id, source.source, source.impact, [...source.parameterIds, ...(source.estimateIds ?? [])].join(", ") || "—", source.alternatives.map((alternative) => `${alternative.alternative} (not chosen: ${alternative.reasonNotSelected})`).join("; ") || "—", source.key ? "Yes" : "No"]) : [["None", "—", "—", "—", "—", "—"]]));
  const cases = a.sensitivityCases ?? [];
  out.push(heading("Sensitivity cases", HeadingLevel.HEADING_2));
  out.push(dataTable(["Case", "Changes", "Parameter", "Low", "High", "Results"], cases.length > 0 ? cases.map((item) => {
    const result = sensitivityResult(a, item);
    return [`${item.id} · ${item.name}`, SENSITIVITY_KIND_LABELS[item.kind], item.parameterId ?? item.estimateId ?? "—", val(result.low), val(result.high), item.results ?? "—"];
  }) : [["None", "—", "—", "—", "—", "—"]]));

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
  out.push(dataTable(["Basic event", "Parameter", "Type", "Evidence"], params.map((p) => [p.basicEventRef ?? "—", p.name, TYPE_LABELS[p.parameterType] ?? p.parameterType, p.evidenceKind !== undefined ? EVIDENCE_KIND_LABELS[p.evidenceKind] : "—"])));

  out.push(heading("Data sources (generic · design · expert)", HeadingLevel.HEADING_1));
  out.push(para(doc.genericParameterSources));
  out.push(dataTable(["Source", "Evidence", "Origin", "Years", "Estimates"], sources.length > 0 ? sources.map((s) => [s.name, EVIDENCE_KIND_LABELS[s.kind], SOURCE_ORIGIN_LABELS[s.origin], `${s.yearsFrom ?? "?"} to ${s.yearsTo ?? "?"}`, String(libraryCount(s))]) : [["None", "—", "—", "—", "—"]]));
  if (elicitations.length > 0) out.push(dataTable(["Elicitation", "Technical issue", "Evaluators", "Owner"], elicitations.map((e) => [e.id, e.issue, String(e.experts.filter((x) => x.role === "EVALUATOR").length), e.integrator])));

  out.push(heading("Data updating process", HeadingLevel.HEADING_1));
  out.push(para(doc.bayesianPriorRationales));
  out.push(para(doc.multiPosGenericUse));

  out.push(heading("Testing & maintenance (with recovery)", HeadingLevel.HEADING_1));
  out.push(para(doc.demandAndExposureCounting));
  out.push(para(doc.repairAndRecoveryData));
  const maintenance = maintenanceParameters(a);
  out.push(heading("Test and maintenance unavailability", HeadingLevel.HEADING_2));
  out.push(dataTable(["Parameter", "Kind", "Method", "Hours out", "Hours required", "Mean"], maintenance.length > 0 ? maintenance.map((p) => {
    const estimate = maintenanceEstimate(a, p);
    return [`${p.uuid} · ${p.name}`, MAINTENANCE_KIND_LABELS[estimate.kind], estimate.method === undefined ? "Not chosen" : MAINTENANCE_METHOD_LABELS[estimate.method], hours(estimate.countedHours), hours(estimate.requiredHours), val(p.value)];
  }) : [["None", "—", "—", "—", "—", "—"]]));
  const restoration = restorationParameters(a);
  out.push(heading("Repair and recovery", HeadingLevel.HEADING_2));
  out.push(dataTable(["Parameter", "Kind", "Method", "Window (h)", "State and sequence", "Mean", "Comparison"], restoration.length > 0 ? restoration.map((p) => {
    const estimate = restorationEstimate(a, p);
    return [`${p.uuid} · ${p.name}`, RESTORATION_KIND_LABELS[estimate.kind], estimate.method === undefined ? "Not chosen" : RESTORATION_FROM_LABELS[estimate.method], hours(estimate.window), p.restoration?.sequence ?? "—", val(p.value), val(estimate.comparisonMean)];
  }) : [["None", "—", "—", "—", "—", "—", "—"]]));
  const outages = a.outages ?? [];
  out.push(heading("Outages", HeadingLevel.HEADING_2));
  out.push(dataTable(["Outage", "Evolution", "State", "Hours each", "Per year"], outages.length > 0 ? outages.map((o) => [o.id, o.evolution, o.stateId ?? "—", hours(o.hours), hours(o.perYear)]) : [["None", "—", "—", "—", "—"]]));

  out.push(heading("Component failure data", HeadingLevel.HEADING_1));
  out.push(dataTable(["Parameter", "Type", "Value", "Risk-significant"], params.map((p) => [p.name, TYPE_LABELS[p.parameterType] ?? p.parameterType, val(p.value), p.isRiskSignificant === true ? "Yes" : "No"])));

  out.push(heading("Common-cause failure data", HeadingLevel.HEADING_1));
  out.push(para(doc.ccfParameterBasis));
  out.push(dataTable(["Group", "Size", "Testing", "Method", "Template", "To Systems Analysis", "All fail, each"], ccfs.length > 0 ? ccfs.map((c) => {
    const result = ccfResult(a, c);
    const all = result.combinations[result.combinations.length - 1];
    return [`${c.uuid} · ${c.name ?? c.ccfGroupReference}`, c.groupSize === undefined ? "—" : String(c.groupSize), c.testing === undefined ? "Not set" : CCF_TESTING_LABELS[c.testing], c.method === undefined ? "Not chosen" : CCF_METHOD_LABELS[c.method], c.priorTemplate ?? "—", `${CCF_MODEL_LABELS[c.modelType] ?? c.modelType}, ${Object.entries(c.parameters).map(([k, v]) => `${k} ${val(v)}`).join(", ")}`, val(all?.each)];
  }) : [["None", "—", "—", "—", "—", "—", "—"]]));

  const frequencies = frequencyParameters(a);
  out.push(heading("Initiating event frequency data", HeadingLevel.HEADING_1));
  out.push(dataTable(["Parameter", "Category", "Value from", "Mean", "5th", "95th"], frequencies.length > 0 ? frequencies.map((p) => {
    const estimate = p.valueMode === "CALCULATED" ? frequencyEstimate(a, p) : undefined;
    const mode = p.valueMode === "CALCULATED" ? "CALCULATED" : p.valueMode === "LINKED" ? "LINKED" : "TYPED";
    return [`${p.uuid} · ${p.name}`, p.frequency?.category === undefined ? "—" : INITIATOR_CATEGORY_LABELS[p.frequency.category], FREQUENCY_MODE_LABELS[mode], val(p.value), val(estimate?.p05), val(estimate?.p95)];
  }) : [["None", "—", "—", "—", "—", "—"]]));

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
