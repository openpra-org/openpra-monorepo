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
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { analysisModelBasicEvents } from "./syUncertainty";
import { AnalysisRunDetailsSchema, AnalysisRunProvenanceListSchema } from "interfaces-shared-types/newly-developed-methods/shared";
import { FaultTreeAnalysisResultSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { fetchJson } from "../api/client";

type ReportKind = "methodology" | "system";
interface UncertaintySummary { modelId: string; mean: number; lower: number; upper: number; samples: number }

async function currentUncertaintySummaries(workbookId: string | null, revision: number | null): Promise<UncertaintySummary[]> {
  if (workbookId === null || revision === null) return [];
  const base = `/api/sy-workbooks/${encodeURIComponent(workbookId)}/analysis-runs`;
  const summaries = new Map<string, UncertaintySummary>();
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 10; page++) {
      const list = AnalysisRunProvenanceListSchema.parse(await fetchJson<unknown>(base + (cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`)));
      for (const { run } of list.runs) {
        if (run.methodType !== "FAULT_TREE" || run.status !== "SUCCEEDED" || run.owner.workbookRevision !== revision
          || run.freshness?.status !== "CURRENT" || summaries.has(run.owner.modelId)) continue;
        const details = AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${run.id}/details`));
        if (details.request["calculationType"] !== "UNCERTAINTY" || details.request["uncertaintyInputSource"] !== "DA") continue;
        const result = FaultTreeAnalysisResultSchema.safeParse(details.result);
        if (!result.success || result.data.uncertainty === undefined) continue;
        const quantiles = result.data.uncertainty.quantiles;
        summaries.set(run.owner.modelId, { modelId: run.owner.modelId, mean: result.data.uncertainty.mean,
          lower: quantiles.find((item) => item.probability === 0.05)?.value ?? quantiles[0]?.value ?? result.data.uncertainty.mean,
          upper: quantiles.find((item) => item.probability === 0.95)?.value ?? quantiles[quantiles.length - 1]?.value ?? result.data.uncertainty.mean,
          samples: result.data.uncertainty.sampleCount });
      }
      if (list.nextCursor === undefined || list.nextCursor === null) break;
      cursor = list.nextCursor;
    }
  } catch { return [...summaries.values()]; }
  return [...summaries.values()];
}

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

function introSection(a: SystemsAnalysis, stageLabel: string): (Paragraph | Table)[] {
  const doc = a.documentation;
  return [
    heading("Introduction", HeadingLevel.HEADING_1),
    heading("Purpose", HeadingLevel.HEADING_2),
    para(doc.processDescription),
    heading("Scope", HeadingLevel.HEADING_2),
    para(a.praScope),
    heading("Relationship to other documents", HeadingLevel.HEADING_2),
    para(doc.praTaskInterfaces),
    heading("Document layout", HeadingLevel.HEADING_2),
    para("This report covers the assumptions and limitations, the system breakdown structure and the methodologies, followed by the data sources and references."),
    heading("Quality assurance", HeadingLevel.HEADING_2),
    para(doc.informationSources),
    heading("Freeze date", HeadingLevel.HEADING_2),
    para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}. Stage: ${stageLabel}.`),
    heading("Assumptions & limitations", HeadingLevel.HEADING_1),
    para(doc.asBuiltLimitations),
  ];
}

function buildMethodology(a: SystemsAnalysis, final: boolean, summaries: UncertaintySummary[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — Systems Analysis Methodology`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `${stageLabel} PRA Model`, size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Systems Analysis (SY) methodology for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.systemDefinitions.length} systems, ${a.commonCauseFailureGroups.length} common cause groups and ${a.systemDependencies.length} support dependencies have been recorded against the ${ccLabel} capability target.`));

  out.push(...introSection(a, stageLabel));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("System breakdown structure & systems analysis", HeadingLevel.HEADING_1));
  out.push(heading("Selected systems", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["System", "Representation", "Mission time"],
    a.systemDefinitions.map((s) => [s.name, a.systemLogicModels.find((m) => m.systemReference === s.uuid)?.modelRepresentation ?? "—", s.missionTimeHours !== undefined ? `${s.missionTimeHours} h` : "—"]),
  ));
  out.push(heading("Grouping retained systems", HeadingLevel.HEADING_2));
  out.push(para(doc.modeledComponentsAndFailureModes));

  out.push(heading("Methodologies & guidelines", HeadingLevel.HEADING_1));
  out.push(heading("Constructing fault trees", HeadingLevel.HEADING_2));
  out.push(para(doc.successCriteriaRelationship));
  out.push(heading("Dependencies", HeadingLevel.HEADING_2));
  out.push(para(doc.dependencySearchAndTables));
  out.push(heading("Boundaries", HeadingLevel.HEADING_2));
  out.push(para(doc.systemFunctionsAndBoundaries));
  out.push(heading("Labeling scheme", HeadingLevel.HEADING_2));
  out.push(para(doc.nomenclatureConventions));

  out.push(heading("Common cause failure groups", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Group", "Scope", "Model", "DA reference"],
    a.commonCauseFailureGroups.map((g) => [g.name, g.scope, g.modelType, g.dataAnalysisCCFParameterRef ?? "—"]),
  ));

  out.push(heading("Uncertainty analysis", HeadingLevel.HEADING_1));
  out.push(para("Data Analysis owns parameter estimates and distributions. Systems Analysis links those inputs to basic events and records uncertainty in model assumptions."));
  out.push(dataTable(["System", "Model assumption", "Treatment"],
    (a.uncertaintyAnalyses ?? []).flatMap((analysis) => analysis.modelUncertainties.map((item) => [
      a.systemDefinitions.find((system) => system.uuid === analysis.system)?.name ?? analysis.system,
      item.description || "—", item.treatmentApproach || "Open",
    ]))));
  out.push(heading("Current uncertainty results", HeadingLevel.HEADING_2));
  out.push(dataTable(["Fault tree", "Mean", "5%", "95%", "Samples"], summaries.length === 0 ? [["No current saved run", "—", "—", "—", "—"]] :
    summaries.map((item) => [a.systemLogicModels.find((model) => model.uuid === item.modelId)?.code ?? item.modelId,
      item.mean.toExponential(3), item.lower.toExponential(3), item.upper.toExponential(3), item.samples.toLocaleString()])));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("System design descriptions and P&IDs"));
  out.push(bullet("Failure mode and effects analyses"));
  out.push(bullet("Common cause parameter dossier (Data Analysis)"));
  out.push(bullet("Digital I&C reliability method (Part II Subpart 2.7)"));
  return out;
}

function buildSystemReport(a: SystemsAnalysis, systemId: string, final: boolean, summaries: UncertaintySummary[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const sysDef = a.systemDefinitions.find((s) => s.uuid === systemId) ?? a.systemDefinitions[0];
  const logic = a.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const logicBasicEvents = logic === undefined ? [] : analysisModelBasicEvents(a, logic);
  const ccfGroups = a.commonCauseFailureGroups.filter((g) => g.affectedSystems.includes(sysDef.uuid));
  const deps = a.systemDependencies.filter((d) => d.dependentSystem === sysDef.uuid);

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — Preliminary Systems Analysis`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: sysDef.name, size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This report documents the system logic model for ${sysDef.name} during the ${stageLabel.toLowerCase()} stage, including its boundary, dependencies, common cause groups and modeled basic events.`));

  out.push(...introSection(a, stageLabel));

  out.push(heading("System description", HeadingLevel.HEADING_1));
  out.push(para(sysDef.description ?? sysDef.name));
  out.push(heading("System boundary", HeadingLevel.HEADING_2));
  for (const b of sysDef.boundaries) out.push(bullet(b));
  out.push(heading("Dependency & shared components", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Supporting system", "Type", "Detail"],
    deps.length > 0 ? deps.map((d) => [d.supportingSystem, String(d.type), d.details ?? "—"]) : [["None", "—", "—"]],
  ));

  out.push(heading("Model development", HeadingLevel.HEADING_1));
  out.push(heading("Modeling approach", HeadingLevel.HEADING_2));
  out.push(para(logic?.description ?? sysDef.description ?? sysDef.name));
  out.push(heading("Common cause failures", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Group", "Model", "Members"],
    ccfGroups.length > 0 ? ccfGroups.map((g) => [g.name, g.modelType, g.affectedComponents.join(", ")]) : [["None", "—", "—"]],
  ));
  out.push(heading("Basic event data", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Basic event", "Failure mode", "Probability"],
    logicBasicEvents.length > 0
      ? logicBasicEvents.map((e) => [e.uuid, String(e.failureMode ?? "—"), e.probability !== undefined ? e.probability.toExponential(1) : "—"])
      : [["None", "—", "—"]],
  ));

  out.push(heading("Uncertainty analysis", HeadingLevel.HEADING_1));
  out.push(para("Parameter uncertainty distributions are maintained in Data Analysis and sampled through the linked basic events. Run results and source revisions are recorded in the workbook analysis history."));
  out.push(dataTable(["Basic event", "DA parameter", "Source workbook"],
    logicBasicEvents.flatMap((event) => event.controlledDataSource?.referenceType === "WORKBOOK_PARAMETER" ? [[
      event.code ?? event.uuid, event.controlledDataSource.entityId, event.controlledDataSource.workbookId,
    ]] : [])));
  out.push(heading("Model assumptions", HeadingLevel.HEADING_2));
  out.push(dataTable(["Assumption", "Impact", "Treatment"],
    (a.uncertaintyAnalyses ?? []).filter((analysis) => analysis.system === sysDef.uuid)
      .flatMap((analysis) => analysis.modelUncertainties.map((item) => [item.description || "—", item.impact || "—", item.treatmentApproach || "Open"]))));
  if (a.plantStage === "PRE_OPERATIONAL") {
    out.push(heading("Pre-operational assumptions", HeadingLevel.HEADING_2));
    out.push(dataTable(["Assumption", "Status", "Closure basis"],
      (a.preOperationalAssumptions ?? []).filter((item) => item.affectedElementIds.includes(sysDef.uuid) || (item.affectedElementIds.length === 0 && sysDef.uuid === a.systemDefinitions[0]?.uuid))
        .map((item) => [item.description || "—", item.status, item.closureBasis || "—"])));
  }

  out.push(heading("Results", HeadingLevel.HEADING_1));
  out.push(para("The system fault tree is quantified standalone, with the full-plant quantification performed by Event Sequence Quantification."));
  const summary = logic === undefined ? undefined : summaries.find((item) => item.modelId === logic.uuid);
  if (summary !== undefined) out.push(para(`Current uncertainty run: mean top-event probability ${summary.mean.toExponential(3)}, 5% quantile ${summary.lower.toExponential(3)}, 95% quantile ${summary.upper.toExponential(3)}, ${summary.samples.toLocaleString()} samples.`));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("System design description and P&ID"));
  out.push(bullet("Failure mode and effects analysis"));
  out.push(bullet("Common cause parameter dossier (Data Analysis)"));
  return out;
}

async function generateSyReport(sy: SystemsAnalysis, report: ReportKind, systemId: string, final: boolean, workbookId: string | null = null, revision: number | null = null): Promise<void> {
  const summaries = await currentUncertaintySummaries(workbookId, revision);
  const children = report === "methodology" ? buildMethodology(sy, final, summaries) : buildSystemReport(sy, systemId, final, summaries);
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const label = report === "methodology" ? "Methodology" : "Per-system";
  link.href = url;
  link.download = `${sy.name} — SY ${label}${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateSyReport, type ReportKind };
