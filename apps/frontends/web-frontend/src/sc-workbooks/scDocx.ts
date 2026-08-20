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
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";

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

function endStateLabel(s: string): string {
  return s === "SUCCESSFUL_MITIGATION" ? "Safe stable state" : "Radionuclide release";
}

function buildChildren(a: SuccessCriteriaDevelopment, final: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const stageLabel = a.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational";
  const ccLabel = a.capabilityCategory ?? "N/A";
  const doc = a.documentation;
  const safeEndStates = a.endStateDefinitions.filter((e) => String(e.endState) === "SUCCESSFUL_MITIGATION");
  const releaseEndStates = a.endStateDefinitions.filter((e) => String(e.endState) !== "SUCCESSFUL_MITIGATION");

  out.push(
    new Paragraph({ children: [new TextRun({ text: `${a.name} — ${stageLabel} PRA Model`, bold: true, size: 48 })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: "Preliminary Success Criteria Development", size: 28, color: "4C4452" })], spacing: { after: 120 } }),
    para(`Capability category target: ${ccLabel}. Scope: ${a.praScope}`),
    para(final ? "Status: final — all required items satisfied." : "Status: draft — open items flagged inline."),
  );

  out.push(heading("Executive summary", HeadingLevel.HEADING_1));
  out.push(para(`This document presents the preliminary Success Criteria (SC) development for ${a.name}, prepared during the ${stageLabel.toLowerCase()} stage. ${a.safetyFunctionSuccessCriteria.length} success criteria across ${a.endStateDefinitions.length} end states, ${a.missionTimes.length} mission times, and ${a.engineeringAnalyses.length} engineering analyses have been recorded against the ${ccLabel} capability target.`));

  out.push(heading("Introduction", HeadingLevel.HEADING_1));
  out.push(heading("Purpose", HeadingLevel.HEADING_2));
  out.push(para(doc.processDescription));
  out.push(heading("Scope", HeadingLevel.HEADING_2));
  out.push(para(a.praScope));
  out.push(heading("Relationship to other documents", HeadingLevel.HEADING_2));
  out.push(para(doc.praTaskInterfaces));
  out.push(heading("Document layout", HeadingLevel.HEADING_2));
  out.push(para("This report covers the assumptions and limitations, the definition and requirements for success criteria, the success criteria and their engineering bases, and the identified uncertainties, followed by the supporting references."));
  out.push(heading("Quality assurance", HeadingLevel.HEADING_2));
  out.push(para(doc.calculationsAndCodesUsed));
  out.push(heading("Freeze date", HeadingLevel.HEADING_2));
  out.push(para(`Model version ${a.version}. Analysis date: ${a.metadata.analysisDate}.`));

  out.push(heading("Assumptions & limitations", HeadingLevel.HEADING_1));
  out.push(para(doc.asBuiltLimitations));
  for (const l of a.metadata.limitations) out.push(bullet(l));

  out.push(heading("Definition & requirements for success criteria", HeadingLevel.HEADING_1));
  out.push(heading("Scope of success criteria", HeadingLevel.HEADING_2));
  out.push(para(doc.endStateDefinitionsBasis));
  out.push(heading("Safe stable end states", HeadingLevel.HEADING_2));
  out.push(para(`Safe stable state. ${a.safeStableStateDefinition.definition} Basis: ${a.safeStableStateDefinition.basis}`));
  out.push(dataTable(
    ["End state", "Definition"],
    safeEndStates.map((e) => [endStateLabel(String(e.endState)), e.definition]),
  ));
  out.push(heading("End states involving a release", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["End state", "Release category", "Definition"],
    releaseEndStates.map((e) => [endStateLabel(String(e.endState)), e.resultingReleaseCategoryId ?? (e.releaseCategoryReferences[0] ?? "—"), e.definition]),
  ));

  out.push(heading("Success criteria & bases", HeadingLevel.HEADING_1));
  out.push(heading("Functional success criteria", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Function", "Initiating event", "State", "Criterion"],
    a.safetyFunctionSuccessCriteria.map((c) => [c.safetyFunctionId, c.initiatingEventId, c.plantOperatingStateId, c.criteria.join("; ")]),
  ));
  out.push(heading("Event-specific functional SC & mission times", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Sequence", "Mission time", "Reaches safe state", "Basis"],
    a.missionTimes.map((m) => [m.eventSequenceReference, `${m.missionTimeHours} h`, m.safeStableStateAchievedWithinMissionTime ? "Yes" : "No (treatment applied)", m.basis]),
  ));
  out.push(heading("Success criteria basis", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["ID", "Type", "Description", "Code", "Applicability"],
    a.engineeringAnalyses.map((an) => [an.analysisId, String(an.analysisType), an.description, an.computerCode ?? "—", an.applicabilityToPlantConditions]),
  ));
  out.push(heading("System-level success criteria", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["System", "Required capacity", "Value", "Basis"],
    (a.systemSuccessCriteria ?? []).flatMap((s) => s.requiredCapacities.map((cap) => [s.description, cap.parameter, cap.value, cap.basis])),
  ));
  out.push(heading("Plant response analyses to confirm SC", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Barrier", "Parameter", "Criterion", "Method"],
    a.radionuclideBarrierCriteria.map((b) => [b.barrierId, b.protectionParameters[0]?.parameter ?? "—", b.protectionParameters[0]?.criterion ?? "—", b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic" : "Conservative"]),
  ));

  out.push(heading("Identified uncertainties", HeadingLevel.HEADING_1));
  out.push(para(doc.modelUncertaintySources));
  out.push(para(doc.consistencyWithPlantDesign));

  out.push(heading("Conformance summary", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "HLR", "Category", "Status", "Evidence"],
    a.conformanceMatrix.map((c) => [c.sr, c.hlr, c.capabilityCategory, c.status, c.evidence]),
  ));

  out.push(heading("References", HeadingLevel.HEADING_1));
  out.push(bullet("Thermal-fluid calculation package (SAS4A/SASSYS-1)"));
  out.push(bullet("Structural seismic capacity report (ANSYS)"));
  out.push(bullet("Confinement source-term analysis (MELCOR)"));
  out.push(bullet("Code V&V and applicability dossier"));
  out.push(bullet("Expert-judgment record, sodium fire (Section 4.2)"));

  return out;
}

async function generateScReport(sc: SuccessCriteriaDevelopment, final: boolean): Promise<void> {
  const doc = new Document({ sections: [{ children: buildChildren(sc, final) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sc.name} — SC Development${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateScReport };
