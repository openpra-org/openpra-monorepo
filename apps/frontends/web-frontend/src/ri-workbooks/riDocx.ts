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
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";

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
  return v === undefined ? "n/a" : v.toExponential(1).replace("e", "E");
}

function buildChildren(a: RiskIntegration, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — Integrated Risk`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Risk Integration", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive Summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Risk Integration (RI) for ${a.name}. ${a.compiledRiskInputs.length} event sequence families have been compiled and integrated against the ${ccLabel} capability target.`));
  out.push(para(doc.resultsSummary));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, Scope & Relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(doc.inputsDescription));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality Assurance & Freeze Date", HeadingLevel.HEADING_2));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions and Limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.scopeLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Risk Criteria for the Safety Case", HeadingLevel.HEADING_1));
  out.push(para(doc.riskSignificanceCriteriaUsed));
  out.push(dataTable(
    ["Criteria", "Application type", "Source", "Justification"],
    a.riskSignificanceCriteria.map((c) => [c.name, c.applicationType, c.criteriaSource, c.justification]),
  ));
  out.push(para(`Minimum reporting frequency: ${val(a.reportingThresholds.minimumReportingFrequencyPerPlantYear)} per plant-year (${a.reportingThresholds.frequencyBasis}). Minimum reporting consequence: ${a.reportingThresholds.minimumReportingConsequenceDescription} (${a.reportingThresholds.consequenceBasis}).`));

  out.push(heading("Methodology", HeadingLevel.HEADING_1));
  out.push(para(doc.appliedMethods));
  out.push(dataTable(
    ["Method", "Scope justification"],
    a.integrationMethods.map((m) => [m.name, m.scopeJustification]),
  ));

  out.push(heading("Results", HeadingLevel.HEADING_1));
  out.push(heading("Frequencies and Consequences of Individual LBEs", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Family", "Release category", "Frequency (per yr)", "Latent risk (per event)", "Dose (Sv)"],
    a.compiledRiskInputs.map((f) => [
      f.eventSequenceFamilyRef,
      f.releaseCategoryRef ?? "n/a",
      val(f.frequency),
      val(f.consequences.find((c) => c.metric === "Latent cancer risk")?.meanValue),
      val(f.consequences.find((c) => c.metric === "Site-boundary individual dose")?.meanValue),
    ]),
  ));
  out.push(heading("Cumulative Risk Results", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Metric", "Value", "Units", "Target", "Status"],
    a.integratedRiskResults.metrics.map((m) => [m.name, val(m.value), m.units, val(m.acceptanceCriteria?.limit), m.acceptanceCriteria?.complianceStatus ?? "n/a"]),
  ));
  out.push(heading("Risk Significant LBEs and Other PRA Items", HeadingLevel.HEADING_2));
  out.push(para(doc.integratedContributorRollup));
  const contributors = [
    ...(a.significantContributors.significantEventSequenceFamilies ?? []),
    ...(a.significantContributors.significantBasicEvents ?? []),
    ...(a.significantContributors.significantHumanFailureEvents ?? []),
    ...(a.significantContributors.significantSystems ?? []),
  ];
  out.push(dataTable(
    ["Contributor", "Type", "Significance", "Basis"],
    contributors.map((c) => [c.name, c.contributorType, c.importanceLevel ?? "n/a", c.context ?? ""]),
  ));

  out.push(heading("Uncertainty Analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.keyUncertaintySources));
  out.push(dataTable(
    ["Source", "Originating element", "Impact"],
    a.modelUncertaintySources.map((u) => [u.name, u.originatingElement, u.impactAssessment]),
  ));
  for (const u of a.uncertaintyAnalyses) {
    out.push(para(`${u.name}: ${u.description ?? ""} Propagation: ${u.propagationMethod}.`));
  }

  out.push(heading("Sensitivity Analyses", HeadingLevel.HEADING_1));
  for (const s of a.sensitivityStudies ?? []) out.push(bullet(`${s.name ?? "Sensitivity study"}: ${s.results ?? ""}`));

  out.push(heading("Risk Insights and Recommendations", HeadingLevel.HEADING_1));
  out.push(para(doc.resultsAndInsights));
  out.push(para(doc.designFeatureInsights));
  out.push(para(doc.traceabilityToUpstreamContributions));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Event sequence family frequencies from the quantification"));
  out.push(bullet("Family-by-family consequence table from the consequence analysis"));
  out.push(bullet("Intended-application and licensing-basis definition"));
  out.push(bullet("Model-uncertainty registers from the upstream elements"));
  out.push(bullet("Screened-item logs from every element"));
  return out;
}

async function generateRiReport(ri: RiskIntegration, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(ri, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ri.name} — RI Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateRiReport };
