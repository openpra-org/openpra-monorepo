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
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";

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

function hep(v: number | undefined): string {
  return v === undefined ? "—" : v.toExponential(1).replace("e", "E");
}

function quantRows(a: HumanReliabilityAnalysis, ids: string[]): string[][] {
  return ids.map((id) => {
    const q = a.hepQuantifications.find((x) => x.hfeId === id);
    const h = a.humanFailureEvents.find((x) => x.uuid === id);
    const value = q?.meanHep ?? q?.pointEstimateHep;
    return [h?.name ?? id, q?.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed" : "Conservative", hep(value), q?.isRiskSignificant ? "Yes" : "No"];
  });
}

function buildChildren(a: HumanReliabilityAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const pre = a.humanFailureEvents.filter((h) => h.hfeTiming === "PRE_INITIATOR");
  const at = a.humanFailureEvents.filter((h) => h.hfeTiming === "AT_INITIATOR");
  const post = a.humanFailureEvents.filter((h) => h.hfeTiming === "POST_INITIATOR");

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Human Reliability Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Human Reliability Analysis (HR) for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.humanFailureEvents.length} human failure events across three moments, ${a.hepQuantifications.length} quantifications and ${a.recoveryActions?.length ?? 0} recovery actions have been recorded against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other documents", HeadingLevel.HEADING_2));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(doc.hepMethodologies));
  out.push(heading("Freeze date", HeadingLevel.HEADING_2));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Methodologies", HeadingLevel.HEADING_1));
  out.push(para(doc.hepMethodologies));
  out.push(para(doc.timingAnalysisBases));

  out.push(heading("Operator actions", HeadingLevel.HEADING_1));
  out.push(heading("Pre-initiator human failure events", HeadingLevel.HEADING_2));
  out.push(dataTable(["Event", "Impact", "Description"], pre.map((h) => [h.name, h.impactLevel, h.description])));
  out.push(heading("At-initiator human failure events", HeadingLevel.HEADING_2));
  out.push(dataTable(["Event", "Impact", "Description"], at.length > 0 ? at.map((h) => [h.name, h.impactLevel, h.description]) : [["None", "—", "—"]]));
  out.push(heading("Post-initiator human failure events", HeadingLevel.HEADING_2));
  out.push(dataTable(["Event", "Impact", "Cue"], post.map((h) => [h.name, h.impactLevel, h.responseDetail?.cueDescription ?? "—"])));

  out.push(heading("Pre-initiator analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.preInitiatorIdentificationProcess));
  out.push(heading("Quantification", HeadingLevel.HEADING_2));
  out.push(dataTable(["Event", "Assessment", "HEP", "Risk-significant"], quantRows(a, pre.map((h) => h.uuid))));

  out.push(heading("Post-initiator analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.performanceShapingFactorTreatment));
  out.push(heading("Quantification", HeadingLevel.HEADING_2));
  out.push(dataTable(["Event", "Assessment", "HEP", "Risk-significant"], quantRows(a, post.map((h) => h.uuid))));

  out.push(heading("Dependency analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.dependenceTreatmentAndJointFloor));
  out.push(para(`Joint probability floor: ${hep(a.jointHepFloor.minimumJointProbability)}. ${a.jointHepFloor.justification}`));
  out.push(dataTable(
    ["Scope", "Events", "Dependence", "Joint HEP"],
    a.dependencyAssessments.map((d) => [d.scope === "PRE_INITIATOR_SET" ? "Pre-initiator" : "Within sequence", d.hfeIds.join(" + "), d.dependenceLevel, hep(d.jointHep)]),
  ));

  out.push(heading("Recovery", HeadingLevel.HEADING_1));
  out.push(para(doc.recoveryActionFeasibilityAndCredit));
  out.push(dataTable(
    ["Recovery", "Restores", "Applied at"],
    (a.recoveryActions ?? []).length > 0 ? (a.recoveryActions ?? []).map((r) => [r.name, r.restoredFunction, r.appliedAtLevel]) : [["None", "—", "—"]],
  ));

  out.push(heading("Uncertainty quantification", HeadingLevel.HEADING_1));
  out.push(para(doc.modelUncertaintySources));
  out.push(para(doc.consistencyReviewResults));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Emergency and abnormal operating procedures"));
  out.push(bullet("Calibration and surveillance procedures"));
  out.push(bullet("Training program and simulator scenario set"));
  out.push(bullet("Time-reliability and dependence method basis"));
  return out;
}

async function generateHrReport(hr: HumanReliabilityAnalysis, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(hr, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${hr.name} — HR Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateHrReport };
