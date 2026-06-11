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
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";

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

function meanOf(meanFrequency: number | { value: number }): number {
  return typeof meanFrequency === "number" ? meanFrequency : meanFrequency.value;
}

const QUANT_BASIS: Record<string, string> = {
  POINT_ESTIMATE: "Point estimate",
  MEAN_PROPAGATED_SOKC: "Mean, SOKC propagated",
  MEAN_RISK_SIGNIFICANT_PARAMETERS: "Mean, risk-significant parameters",
};

function buildChildren(a: EventSequenceQuantification, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const families = a.familyQuantifications;
  const trunc = a.quantificationMethods.truncation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Event Sequence Quantification", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Event Sequence Quantification (ESQ) for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${families.length} event-sequence families, ${a.barrierQuantifications.length} radionuclide barriers and ${a.riskSignificantContributors.length} risk-significant contributors have been recorded against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, scope & relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(a.praScope));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality assurance & freeze date", HeadingLevel.HEADING_2));
  out.push(para(doc.codeVerificationProcess));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Methodologies", HeadingLevel.HEADING_1));
  out.push(heading("Integration & quantification approach", HeadingLevel.HEADING_2));
  out.push(para(doc.quantificationProcessDescription));
  out.push(heading("Truncation & convergence", HeadingLevel.HEADING_2));
  out.push(para(doc.truncationConvergenceProcess));
  out.push(heading("Solution & approximation", HeadingLevel.HEADING_2));
  out.push(para(doc.appliedMethods));
  out.push(heading("Uncertainty propagation", HeadingLevel.HEADING_2));
  out.push(para(doc.uncertaintySensitivityResults));

  out.push(heading("Model integration & inputs", HeadingLevel.HEADING_1));
  out.push(para(doc.inputsDescription));
  out.push(para(a.modelIntegration.integrationMethod));

  out.push(heading("Event sequence family frequencies", HeadingLevel.HEADING_1));
  out.push(para(doc.familyFrequenciesAndContributions));
  out.push(dataTable(
    ["Family", "Reference", "Basis", "Mean (/yr)", "P95 (/yr)"],
    families.map((f) => [f.name, f.eventSequenceFamilyRef, QUANT_BASIS[f.quantificationBasis] ?? f.quantificationBasis, val(meanOf(f.meanFrequency)), val(f.percentile95)]),
  ));

  out.push(heading("Contribution breakdown", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Family", "Contributor", "Type", "Fraction"],
    families.flatMap((f) => (f.contributionBreakdown ?? []).map((c) => [f.name, c.contributorRef, c.contributorType, `${Math.round(c.fractionalContribution * 100)}%`])),
  ));

  out.push(heading("Truncation convergence records", HeadingLevel.HEADING_1));
  out.push(para(trunc.basisForSelection));
  out.push(dataTable(
    ["Cutoff (/yr)", "Family frequency (/yr)", "Change"],
    trunc.truncationProgression.map((c) => [val(c), val(trunc.frequencyAtTruncation[c]), trunc.percentageChangeAtTruncation[c] !== undefined ? `${trunc.percentageChangeAtTruncation[c]}%` : "base"]),
  ));

  out.push(heading("Cutset review records", HeadingLevel.HEADING_1));
  out.push(para(doc.cutsetReviewProcess));
  out.push(dataTable(
    ["Sample", "Logic", "Findings"],
    [
      ...a.cutsetLogicReviews.map((c) => [c.sampleDescription, c.logicCorrect ? "Correct" : "Issue", c.findings]),
      ...a.nonSignificantSampleReviews.map((c) => [c.sampleDescription, c.physicallyMeaningful ? "Meaningful" : "Issue", c.findings]),
    ],
  ));

  out.push(heading("Flag, mutex & recovery treatment", HeadingLevel.HEADING_1));
  out.push(para(doc.mutuallyExclusiveEventsEliminated));
  out.push(dataTable(
    ["Flag", "State", "Effect"],
    (a.flagEventSettings ?? []).map((f) => [f.name, f.state ? "TRUE" : "FALSE", f.effect]),
  ));

  out.push(heading("Dependency treatment", HeadingLevel.HEADING_1));
  out.push(para(doc.intermediateStateDependencyTreatment));
  out.push(para(a.dependencyTreatment.postInitiatorHfeDependencyBasis));

  out.push(heading("Barrier challenge & capacity", HeadingLevel.HEADING_1));
  out.push(para(doc.barrierChallengeTreatment));
  out.push(para(doc.barrierCapacityBasis));
  out.push(dataTable(
    ["Barrier", "Failure modes", "Challenge basis", "Capacity basis"],
    a.barrierQuantifications.map((b) => [b.name, b.failureModes.map((m) => m.failureMode).join("; "), b.challengeAssessment.basis, b.capacityEvaluation.basis]),
  ));

  out.push(heading("Risk-significant contributors & importance", HeadingLevel.HEADING_1));
  out.push(para(doc.riskSignificantContributorsDocumentation));
  out.push(dataTable(
    ["Contributor", "Type", "Fraction", "Basis"],
    a.riskSignificantContributors.map((c) => [c.entityRef, c.contributorType, c.fractionalContribution !== undefined ? `${Math.round(c.fractionalContribution * 100)}%` : "—", c.riskSignificanceCriteriaBasis]),
  ));
  out.push(para(doc.importanceResults));

  out.push(heading("Screening audit", HeadingLevel.HEADING_1));
  out.push(para(a.screenedEventCumulativeAssessment?.cumulativeImpactAssessment ?? "No screened-event assessment recorded."));

  out.push(heading("Model uncertainty & sensitivity", HeadingLevel.HEADING_1));
  out.push(para(doc.uncertaintySourcesDocumentation));
  for (const s of a.sensitivityStudies ?? []) out.push(bullet(`${s.name ?? "Sensitivity study"}: ${s.results ?? ""}`));

  out.push(heading("Limitations for applications", HeadingLevel.HEADING_1));
  out.push(para(doc.limitationsForApplications));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Event sequence delineation and end states"));
  out.push(bullet("Linked fault-tree and event-tree model"));
  out.push(bullet("Basic-event and common-cause parameter set"));
  out.push(bullet("Truncation convergence study"));
  out.push(bullet("Barrier challenge and capacity analyses"));
  out.push(bullet("Uncertainty propagation method basis"));
  return out;
}

async function generateEsqReport(esq: EventSequenceQuantification, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(esq, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${esq.name} — ESQ Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateEsqReport };
