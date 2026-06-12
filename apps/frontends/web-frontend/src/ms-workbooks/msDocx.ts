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
import { type MechanisticSourceTermAnalysis, type SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";

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

function totalsOf(st: SourceTermDefinition): Map<string, number> {
  const totals = new Map<string, number>();
  for (const phase of st.radionuclideReleases) {
    for (const q of phase.quantities) {
      totals.set(q.radionuclide, (totals.get(q.radionuclide) ?? 0) + q.quantity);
    }
  }
  return totals;
}

function buildChildren(a: MechanisticSourceTermAnalysis, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Mechanistic Source Term Analysis", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive Summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Mechanistic Source Term Analysis (MS) for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.releaseCategories.length} release categories, ${a.sourceInventories.length} source inventories, ${a.transportBarrierAssessments.length} transport barriers and ${a.sourceTermDefinitions.length} source terms have been recorded against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose, Scope & Relationship", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(para(a.praScope));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Quality Assurance & Freeze Date", HeadingLevel.HEADING_2));
  out.push(para(doc.modelsAndComputerPrograms));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions and Limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Sources of Radioactive Material", HeadingLevel.HEADING_1));
  out.push(para(doc.sourceCharacterizationAndInventories));
  out.push(dataTable(
    ["Source", "Basis", "Species"],
    a.sourceInventories.map((s) => [s.name, s.calculationBasis, s.inventory.map((r) => r.radionuclide).join(", ")]),
  ));

  out.push(heading("Release Categories", HeadingLevel.HEADING_1));
  out.push(heading("Definitions of Release Categories", HeadingLevel.HEADING_2));
  out.push(para(doc.releaseCategoryDefinitionBases));
  out.push(dataTable(
    ["Category", "Timing", "Magnitude", "Bounding sequence", "Termination"],
    a.releaseCategories.map((r) => [r.name, r.timingClassification ?? "n/a", r.magnitudeClassification ?? "n/a", r.boundingSequenceReference, `${r.releaseTerminationTime.value} ${r.releaseTerminationTime.unit}`]),
  ));
  out.push(heading("Assignment of Families to Categories", HeadingLevel.HEADING_2));
  out.push(para(doc.sequenceToReleaseCategoryAssignment));
  out.push(dataTable(
    ["Category", "Families"],
    a.releaseCategories.map((r) => [r.uuid, (r.supportingReferences ?? []).join(", ")]),
  ));

  out.push(heading("Radionuclide Transport Barriers", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Barrier", "Type", "Failure modes", "Retention"],
    a.transportBarrierAssessments.map((b) => [b.name, b.barrierType, (b.failureModes ?? []).join("; "), b.transportCharacteristics[0]?.retentionEffectiveness ?? "n/a"]),
  ));

  out.push(heading("Radionuclide Transport Phenomena", HeadingLevel.HEADING_1));
  out.push(para(doc.transportPhenomenaPerCategory));
  out.push(heading("Modeling and Simulation Codes", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Model", "Role", "Validation"],
    (a.sourceTermModels ?? []).map((m) => [m.name, m.technicalBasis, m.validationStatus]),
  ));
  out.push(heading("Selected Radioisotopes", HeadingLevel.HEADING_2));
  out.push(para(a.sourceInventories[0]?.radionuclideSelectionBasis ?? "The dose-significant species are selected."));

  out.push(heading("Results", HeadingLevel.HEADING_1));
  out.push(para(doc.resultsSummary));
  out.push(para(doc.sourceTermParameterTables));
  for (const st of a.sourceTermDefinitions) {
    const category = a.releaseCategories.find((r) => r.uuid === st.releaseCategoryReference);
    const totals = totalsOf(st);
    out.push(heading(category?.name ?? st.releaseCategoryReference, HeadingLevel.HEADING_2));
    out.push(dataTable(
      ["Species", "Total fraction", "Form"],
      st.releaseForms.map((r) => [r.radionuclide, val(totals.get(r.radionuclide)), r.form]),
    ));
  }

  out.push(heading("Uncertainties Analysis", HeadingLevel.HEADING_1));
  out.push(para(doc.uncertaintyAndSensitivityAnalyses));
  out.push(para(doc.modelUncertaintySources));

  out.push(heading("Sensitivity Analyses", HeadingLevel.HEADING_1));
  for (const s of a.sensitivityStudies ?? []) out.push(bullet(`${s.name ?? "Sensitivity study"}: ${s.results ?? ""}`));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Release-category definitions and family assignment"));
  out.push(bullet("Source and barrier inventory from operating states"));
  out.push(bullet("Isotopic depletion and inventory calculation"));
  out.push(bullet("Mechanistic transport calculation records"));
  out.push(bullet("Aerosol dynamics and deposition study"));
  out.push(bullet("Source-term uncertainty and sensitivity basis"));
  return out;
}

async function generateMsReport(ms: MechanisticSourceTermAnalysis, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(ms, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ms.name} — MS Analysis${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateMsReport };
