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
  out.push(para(`This document presents the preliminary Radiological Consequence Analysis (RC) for ${a.name}, prepared against a ${siteLabel.toLowerCase()}. ${a.releaseCategoryToConsequence.releaseCategoryInputs.length} release categories and ${q.eventSequenceConsequences.length} event sequence families have been quantified against the ${ccLabel} capability target.`));
  out.push(para(doc.resultsSummary));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, Scope & Relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(doc.inputsDescription));
  out.push(para(doc.praTaskInterfaces));
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
  out.push(dataTable(
    ["Delay component", "Estimate"],
    (a.protectiveActionParameters.evacuationDelayComponents ?? []).map((d) => [d.component, d.estimate]),
  ));

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
