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
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { DistributionType } from "interfaces-mef-types/core/events";
import { sitePopulation } from "interfaces-shared-types/rc-workbooks/site-receptors";
import { RC_SCOPE_ASPECTS, rcScopeTreatment } from "./rcScope";
import { evacuationDelayMinutes, protectionParameterQuantity, responseSummary, totalEvacuationDelay } from "./rcProtective";

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

function buildChildren(a: RadiologicalConsequenceAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const isBounding = a.releaseCategoryToConsequence.siteInformation.isBounding;
  const siteLabel = isBounding ? "Bounding site" : "Identified site";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const q = a.consequenceQuantification;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${siteLabel}`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Radiological Consequence Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive Summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Radiological Consequence Analysis (RC) for ${a.name}, prepared against a ${siteLabel.toLowerCase()}. It records ${a.releaseCategoryToConsequence.releaseCategoryInputs.length} release categories and ${q.eventSequenceConsequences.length} event sequence families against the ${ccLabel} capability target.`));
  out.push(para(doc.resultsSummary));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, Scope & Relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(doc.inputsDescription));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Evaluation by Aspect", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Aspect", "Included?", "Treatment used", "Reason for exclusion"],
    RC_SCOPE_ASPECTS.map((aspect) => {
      const decision = a.scope.evaluationDecisions?.find((item) => item.subElement === aspect.subElement);
      return [
        `${aspect.label} (Step ${aspect.step})`,
        decision === undefined ? "Not set" : decision.included ? "Included" : "Excluded",
        decision?.included === false ? "—" : rcScopeTreatment(a, aspect.subElement) || "Not recorded",
        decision?.included === false ? decision.exclusionReason?.trim() || "Not recorded" : "—",
      ];
    }),
  ));
  out.push(heading("Quality Assurance & Freeze Date", HeadingLevel.HEADING_2));
  out.push(para(doc.rcqProcess));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions and Limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.rcqLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));
  for (const b of a.boundingSiteAssumptions ?? []) out.push(bullet(`${b.influenceOnDefinition}: ${b.description}`));

  out.push(heading("Release Category to Radiological Consequence", HeadingLevel.HEADING_1));
  out.push(para(doc.rcreProcess));
  if (isBounding) {
    const site = a.releaseCategoryToConsequence.siteInformation;
    out.push(para(`${site.boundingSite.description} ${site.boundingSite.boundingJustification}`));
  }
  out.push(heading("Release Characterization", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Category", "Source term", "Important radionuclides", "Warning time"],
    a.releaseCategoryToConsequence.releaseCategoryInputs.map((c) => [
      c.releaseCategory,
      c.sourceTermDefinitionRef ?? "n/a",
      (c.releaseCharacteristics.importantRadionuclides ?? []).join(", "),
      c.releaseCharacteristics.warningTimeDescription ?? "n/a",
    ]),
  ));

  out.push(heading("Protective Action Parameters and Other Site Data", HeadingLevel.HEADING_1));
  out.push(para(doc.rcpaProcess));
  const pa = a.protectiveActionParameters;
  const population = sitePopulation(pa.siteAndReceptors?.geometry), response = responseSummary(pa, population);
  const responseEvent = pa.responseTiming?.referenceEvent?.trim() || "Emergency declaration";
  out.push(para("This step prepares receptor positions, population groups and response times for the consequence case. It does not calculate dose."));
  if (population !== undefined) out.push(para(`Imported site population: ${population.toLocaleString()} people.`));
  if (response.declaration !== undefined || response.shelterAfterAccident !== undefined || response.departureAfterAccident !== undefined) out.push(dataTable(
    ["Response event", "Minutes after accident start"],
    [[responseEvent, response.declaration], ["Shelter begins", response.shelterAfterAccident], ["Evacuation begins", response.departureAfterAccident]]
      .filter((row): row is [string, number] => row[1] !== undefined).map(([event, minutes]) => [event, String(minutes)]),
  ));
  if (pa.responseTiming?.cohortName) out.push(para(`Response times apply to: ${pa.responseTiming.cohortName}.`));
  if (pa.responseTiming?.source) out.push(para(`Response timing basis: ${pa.responseTiming.source}`));
  if (pa.protectiveActionsIncluded.length) out.push(dataTable(
    ["Action", "Included", "Basis"],
    pa.protectiveActionsIncluded.map((action) => [action.action.replace(/_/g, " "), action.included ? "Yes" : "No", action.applicabilityJustification ?? ""]),
  ));
  if (pa.incidentPhasesModeled.length) out.push(dataTable(
    ["Phase", "Period after release (days)", "Criteria"],
    pa.incidentPhasesModeled.map((phase) => [phase.phase.replace(/_/g, " "), `${phase.startDays ?? "Not set"} to ${phase.endDays ?? "open"}`, phase.criteriaDescription]),
  ));
  if (pa.sourceDocuments.length) for (const source of pa.sourceDocuments) out.push(bullet(`${source.document}: ${source.usage}`));
  if (pa.cohortModeling.cohorts?.length) out.push(dataTable(
    ["Cohort", "Population (%)", "Compliance (%)", "Assumption"],
    pa.cohortModeling.cohorts.map((cohort) => [cohort.name, String(cohort.populationPercent ?? "Not set"), String(cohort.compliancePercent ?? "Not set"), cohort.complianceAssumption ?? cohort.description]),
  ));
  if (pa.shelterInPlaceCredit) out.push(para(`Shelter-in-place credit: ${pa.shelterInPlaceCredit.credited ? "Credited" : "Not credited"}. ${pa.shelterInPlaceCredit.justification ?? ""}`));
  if (pa.protectionParameters?.length) out.push(dataTable(
    ["Protection parameter", "Value", "Unit", "Action / phase", "Source"],
    pa.protectionParameters.map((parameter) => {
      const quantity = protectionParameterQuantity(parameter);
      return [parameter.parameter, quantity.value, quantity.unit, [parameter.action, parameter.phase].filter(Boolean).join(" / ") || "Not assigned", parameter.source];
    }),
  ));
  if (pa.evacuationDelayComponents?.length) {
    out.push(dataTable(["Delay component", "Minutes", "Original estimate"], pa.evacuationDelayComponents.map((delay) => [delay.component.replace(/_/g, " "), String(evacuationDelayMinutes(delay) ?? "Not set"), delay.estimate])));
    const total = totalEvacuationDelay(pa.evacuationDelayComponents);
    if (total !== undefined) out.push(para(`Total evacuation delay: ${total} minutes.`));
  }
  if (pa.evacuationSpeed) out.push(para(`Evacuation speed: ${pa.evacuationSpeed.speedMetresPerSecond ?? "Not set"} m/s. Basis: ${pa.evacuationSpeed.basis}`));
  out.push(dataTable(["Site data", "Basis", "Source or file"], [
    ["Population", pa.populationDistribution.basis, pa.populationDistribution.sourceReference ?? "Not recorded"],
    ["Land use", pa.landUseData.basis, pa.landUseData.sourceReference ?? "Not recorded"],
    ["Plant characteristics", pa.plantPhysicalCharacteristics.basis, pa.plantPhysicalCharacteristics.sourceReference ?? "Not recorded"],
  ]));

  out.push(heading("Meteorological Data", HeadingLevel.HEADING_1));
  out.push(para(doc.rcmeProcess));
  out.push(para(a.meteorologicalData.spatialRepresentativenessJustification));

  out.push(heading("Atmospheric Transport and Dispersion", HeadingLevel.HEADING_1));
  out.push(para(doc.rcadProcess));
  out.push(para(a.atmosphericTransportAndDispersion.dispersionModel.justification));

  out.push(heading("Dosimetry", HeadingLevel.HEADING_1));
  out.push(para(doc.rcdoProcess));

  out.push(heading("Health Effects", HeadingLevel.HEADING_1));
  out.push(para(doc.rcheProcess));
  out.push(dataTable(
    ["Risk-factor source", "Recognized body", "Version"],
    a.healthEffects.riskFactorSources.map((r) => [r.source, r.recognizedBody, r.version ?? "n/a"]),
  ));

  out.push(heading("Economic Factors", HeadingLevel.HEADING_1));
  out.push(para(doc.rcecProcess));
  out.push(dataTable(
    ["Cost category", "Parameters"],
    a.economicFactors.costCategories.map((c) => [c.category, c.parameterDefinitions.join("; ")]),
  ));

  out.push(heading("Consequence Quantification", HeadingLevel.HEADING_1));
  out.push(heading("Modeling and Simulation Codes", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Code", "Benchmark basis"],
    q.consequenceCodesUsed.map((c) => [c.code, c.benchmarkBasis ?? "n/a"]),
  ));

  out.push(heading("Results", HeadingLevel.HEADING_1));
  out.push(para(doc.rcqProcess));
  for (const f of q.eventSequenceConsequences) {
    out.push(heading(`${f.eventSequenceFamily}${f.releaseCategoryReference !== undefined ? ` (bounds ${f.releaseCategoryReference})` : ""}`, HeadingLevel.HEADING_2));
    out.push(dataTable(
      ["Metric", "Mean", "Unit", "90% interval"],
      f.consequenceResults.map((m) => {
        const d = m.uncertaintyDistribution;
        const interval = d !== undefined && d.type === DistributionType.LOGNORMAL
          ? `${val(d.median / d.errorFactor)} to ${val(d.median * d.errorFactor)}`
          : "n/a";
        return [m.metric, val(m.meanValue), m.unit ?? "", interval];
      }),
    ));
  }

  out.push(heading("Uncertainty Analysis", HeadingLevel.HEADING_1));
  out.push(para(q.uncertaintyCharacterization.description));
  out.push(para(doc.rcqModelUncertaintySources));
  for (const d of q.uncertaintyCharacterization.phenomenaDependencies ?? []) {
    out.push(bullet(`${d.dependentPhenomena.join(" and ")}: ${d.description} ${d.treatmentMethod}`));
  }

  out.push(heading("Sensitivity Analyses", HeadingLevel.HEADING_1));
  for (const s of a.sensitivityStudies ?? []) out.push(bullet(`${s.name ?? "Sensitivity study"}: ${s.results ?? ""}`));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Source-term table from the source-term analysis"));
  out.push(bullet("Site emergency plan and notification scheme"));
  out.push(bullet("Evacuation time estimate study"));
  out.push(bullet("Onsite meteorological data record"));
  out.push(bullet("Atmospheric dispersion and deposition records"));
  out.push(bullet("Dosimetry and health-effect parameter basis"));
  out.push(bullet("Regional economic cost data"));
  return out;
}

async function generateRcReport(rc: RadiologicalConsequenceAnalysis, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(rc, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${rc.name} — RC Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateRcReport };
