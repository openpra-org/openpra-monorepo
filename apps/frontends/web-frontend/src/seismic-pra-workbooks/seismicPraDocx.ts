import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { validateSeismicPra } from "interfaces-mef-types/seismic/seismic-pra-validation";

type ReportBlock = Paragraph | Table;

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 }, pageBreakBefore: level === HeadingLevel.HEADING_1 });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text || "Not documented.")], spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 }, spacing: { after: 60 } });
}

function cell(text: string, header: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 17 })] })],
    shading: header ? { fill: "EEE8F6" } : undefined,
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((value) => cell(value, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((value) => cell(value, false)) })),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D8D0E0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D8D0E0" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D8D0E0" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D8D0E0" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "ECE7F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "ECE7F0" },
    },
  });
}

function scientific(value: number | undefined): string {
  return value === undefined ? "—" : value.toExponential(3).replace("e", "E");
}

function buildChildren(mef: SeismicPRA, final: boolean): ReportBlock[] {
  const out: ReportBlock[] = [];
  const sha = mef.seismicHazardAnalysis;
  const sfr = mef.seismicFragilityAnalysis;
  const spr = mef.seismicPlantResponseAnalysis;
  const site = mef.metadata.plantIdentity;
  const dispositioned = mef.conformanceMatrix.filter((row) => row.status === "MET" || row.status === "NOT_APPLICABLE").length;

  out.push(
    new Paragraph({ children: [new TextRun({ text: mef.name, bold: true, size: 48, color: "352943" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: "Integrated Seismic Probabilistic Risk Assessment", size: 28, color: "62566E" })], spacing: { after: 160 } }),
    para(`Plant: ${site?.name ?? "Not specified"}. Site: ${site?.siteName ?? "Not specified"}. Reactor type: ${site?.reactorType ?? "Not specified"}.`),
    para(`Plant stage: ${mef.plantStage.replace(/_/g, " ")}. Capability category: ${mef.capabilityCategory ?? "Not specified"}. Model version: ${mef.version}.`),
    para(final ? "Status: controlled final report." : "Status: draft report; verify open items and signatures before controlled use."),
    para(`Conformance disposition: ${dispositioned} of ${mef.conformanceMatrix.length} supporting requirements.`),
  );

  out.push(heading("Executive Summary", HeadingLevel.HEADING_1));
  out.push(para(mef.documentation.scopeAndApplications), para(mef.documentation.integratedResultsSummary), para(mef.documentation.integratedRiskInsights));

  out.push(heading("1. Scope, Basis, and Configuration", HeadingLevel.HEADING_1));
  out.push(para(mef.praScope), para(mef.documentation.overallProcessDescription), para(mef.documentation.configurationControlDescription));
  for (const limitation of mef.metadata.limitations) out.push(bullet(limitation));
  out.push(heading("1.1 Intended Applications", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Application", "Status", "Purpose", "Decision context", "Risk metrics", "Limitations"],
    mef.applications.map((application) => [application.name, application.status, application.purpose, application.decisionContext, application.supportedRiskMetrics.join("; "), application.limitations.join("; ")]),
  ));
  out.push(heading("1.2 Configuration Baseline and Evidence", HeadingLevel.HEADING_2));
  out.push(para(`Baseline: ${mef.configurationBaseline.name}. As of: ${mef.configurationBaseline.asOfDate}.`), para(mef.configurationBaseline.changeControlProcess));
  out.push(dataTable(
    ["Evidence", "Type", "Source", "Revision", "Owner", "Status", "Applicability"],
    mef.evidenceRegister.map((evidence) => [evidence.name, evidence.evidenceType, evidence.sourceReference, evidence.revision ?? "—", evidence.owner, evidence.status, evidence.applicability]),
  ));

  out.push(heading("2. Seismic Hazard Analysis (SHA)", HeadingLevel.HEADING_1));
  out.push(para(mef.documentation.shaSummary));
  out.push(heading("2.1 Site and Structured Process", HeadingLevel.HEADING_2));
  out.push(para(sha.analysisBasis.site.selectionAndApplicabilityBasis), para(sha.analysisBasis.structuredProcess.centerBodyRangeDemonstration));
  out.push(dataTable(
    ["Ground-motion parameter", "Type", "Direction", "Units", "Selected range"],
    sha.analysisBasis.groundMotionParameters.map((parameter) => [parameter.name, parameter.parameterType.replace(/_/g, " "), parameter.direction.replace(/_/g, " "), parameter.units, `${parameter.selectedRange.minimum}–${parameter.selectedRange.maximum}`]),
  ));
  out.push(heading("2.2 Earth-Science Inputs", HeadingLevel.HEADING_2), para(sha.earthScienceInputs.dataGapAssessment));
  out.push(dataTable(
    ["Data set", "Discipline", "Coverage", "Currentness"],
    sha.earthScienceInputs.dataSets.map((data) => [data.name, data.discipline, data.spatialCoverage, data.currentnessAssessment]),
  ));
  out.push(heading("2.3 Sources and Ground Motion", HeadingLevel.HEADING_2), para(sha.sourceCharacterization.structuredApproach));
  out.push(dataTable(
    ["Source", "Type", "Closest distance (km)", "MFD models", "Major contributor"],
    sha.sourceCharacterization.earthquakeSources.map((source) => [source.name, source.sourceType.replace(/_/g, " "), String(source.geometry.closestDistanceToSiteKm ?? "—"), String(source.magnitudeFrequencyModels.length), source.majorHazardContributor ? "Yes" : "No"]),
  ));
  out.push(dataTable(
    ["Prediction model", "Kind", "Magnitude range", "Distance range (km)", "Weight"],
    sha.groundMotionCharacterization.predictionModels.map((model) => [model.name, model.modelKind.replace(/_/g, " "), `${model.magnitudeRange.minimum}–${model.magnitudeRange.maximum}`, `${model.distanceRangeKm.minimum}–${model.distanceRangeKm.maximum}`, model.logicTreeWeight.toFixed(3)]),
  ));
  out.push(heading("2.4 Site Response and Hazard Results", HeadingLevel.HEADING_2), para(sha.siteResponseAnalysis.approachJustification));
  out.push(dataTable(
    ["Profile", "Type", "Layers", "Bedrock depth", "Weight"],
    sha.siteResponseAnalysis.profiles.map((profile) => [profile.name, profile.profileType.replace(/_/g, " "), String(profile.layers.length), `${profile.depthToBedrock} ${profile.depthUnit}`, String(profile.profileWeight ?? "—")]),
  ));
  out.push(dataTable(
    ["Hazard interval", "Lower", "Upper", "Representative", "Annual frequency"],
    sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((interval) => [interval.name, `${interval.lowerGroundMotion} ${interval.groundMotionUnits}`, `${interval.upperGroundMotion} ${interval.groundMotionUnits}`, `${interval.representativeGroundMotion} ${interval.groundMotionUnits}`, scientific(interval.annualFrequency)]),
  ));
  out.push(heading("2.5 Secondary Seismic Hazards", HeadingLevel.HEADING_2), para(sha.secondaryHazardEvaluation.identificationMethod));
  out.push(dataTable(
    ["Hazard", "Type", "Disposition", "Criterion", "Affected SEL items"],
    sha.secondaryHazardEvaluation.hazards.map((hazard) => [hazard.name, hazard.hazardType.replace(/_/g, " "), hazard.screening.disposition.replace(/_/g, " "), hazard.screening.criterion, String(hazard.potentiallyAffectedSeismicEquipmentListItemRefs.length)]),
  ));

  out.push(heading("3. Seismic Fragility Analysis (SFR)", HeadingLevel.HEADING_1), para(mef.documentation.sfrSummary));
  out.push(heading("3.1 Equipment Scope and Response", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["SEL item", "Type", "Location", "Failure modes", "Disposition"],
    spr.seismicEquipmentListDevelopment.equipment.map((item) => [item.name, item.sscType, item.building, item.failureModes.map((mode) => mode.name).join("; "), item.disposition.replace(/_/g, " ")]),
  ));
  out.push(para(sfr.seismicResponseAnalysis.groundMotionParameterConsistency), para(sfr.seismicResponseAnalysis.controlPointConsistency));
  out.push(dataTable(
    ["Structural model", "Software", "Condition", "Modes"],
    sfr.seismicResponseAnalysis.structuralModels.map((model) => [model.name, model.softwareAndVersion, model.asModeledCondition.replace(/_/g, " "), String(model.modalProperties.length)]),
  ));
  out.push(heading("3.2 Thresholds and Plant Investigations", HeadingLevel.HEADING_2), para(sfr.thresholdProgram.screeningConfirmationMethod));
  out.push(dataTable(
    ["Investigation", "Type", "Date", "SSCs reviewed", "Findings"],
    sfr.plantInvestigations.map((investigation) => [investigation.name, investigation.investigationType.replace(/_/g, " "), investigation.date ?? "—", String(investigation.sscRefsReviewed.length), String(investigation.findings.length)]),
  ));
  out.push(heading("3.3 Fragility Results", HeadingLevel.HEADING_2), para(sfr.results.systemsModelTransferBasis));
  out.push(dataTable(
    ["Fragility", "SSC / failure mode", "Median", "βR", "βU", "HCLPF", "Significance"],
    sfr.results.fragilityEvaluations.map((fragility) => [fragility.name, `${fragility.sscRef} / ${fragility.systemsFailureModeRef}`, `${fragility.medianCapacity} ${fragility.capacityUnits}`, String(fragility.betaRandomness), String(fragility.betaUncertainty), String(fragility.highConfidenceLowProbabilityOfFailureCapacity ?? "—"), fragility.riskSignificance]),
  ));

  out.push(heading("4. Seismic Plant Response Analysis (SPR)", HeadingLevel.HEADING_1), para(mef.documentation.sprSummary));
  out.push(heading("4.1 Initiators and Plant Model", HeadingLevel.HEADING_2), para(spr.initiatingEventIdentification.systematicProcess));
  out.push(dataTable(
    ["Initiator", "Origin", "Retained", "Affected SSCs", "Event sequences"],
    [...spr.initiatingEventIdentification.directInitiators, ...spr.initiatingEventIdentification.secondaryHazardInitiators].map((event) => [event.name, event.origin.replace(/_/g, " "), event.retained ? "Yes" : "No", String(event.affectedSscRefs.length), String(event.eventSequenceRefs.length)]),
  ));
  out.push(para(spr.plantResponseModel.completenessAndConsistencyReview));
  out.push(heading("4.2 Seismic Human Reliability", HeadingLevel.HEADING_2), para(spr.humanReliabilityModel.seismicInfluenceIntegration));
  out.push(dataTable(
    ["Human action", "Location", "Available time", "Required time", "HEP", "Recovery"],
    spr.humanReliabilityModel.humanActions.map((action) => [action.name, action.controlRoomOrExControlRoom.replace(/_/g, " "), `${action.availableTime} ${action.timeUnits}`, `${action.requiredTime} ${action.timeUnits}`, String(action.humanErrorProbability), action.recoveryAction ? "Yes" : "No"]),
  ));
  out.push(heading("4.3 Quantification and Risk Contributors", HeadingLevel.HEADING_2), para(spr.quantification.integratedHazardFragilitySystemsMethod));
  out.push(dataTable(
    ["Event-sequence family", "Point estimate", "Mean", "Hazard bins", "Uncertainty sources"],
    spr.quantification.eventSequenceFamilyQuantifications.map((family) => [family.name, scientific(family.pointEstimateFrequency), scientific(family.meanFrequency), String(family.hazardBinContributions.length), String(family.uncertaintyContributions.length)]),
  ));

  out.push(heading("5. SHA–SFR–SPR Integration", HeadingLevel.HEADING_1), para(mef.integration.integrationMethod), para(mef.documentation.subelementInterfaceDescription));
  out.push(dataTable(
    ["Interface", "Producer", "Consumer", "Payload", "Status", "Transfer basis"],
    mef.integration.interfaces.map((item) => [item.name, item.producer, item.consumer, item.payloadType.replace(/_/g, " "), item.consistent ? "Consistent" : "Open", item.transferBasis]),
  ));
  out.push(dataTable(
    ["Consistency check", "Subelements", "Type", "Result", "Evidence"],
    mef.integration.consistencyChecks.map((check) => [check.name, check.subelements.join(" / "), check.checkType.replace(/_/g, " "), check.result, check.evidence]),
  ));

  out.push(heading("6. Integrated Uncertainty and Sensitivity", HeadingLevel.HEADING_1), para(mef.documentation.integratedUncertaintySummary));
  out.push(dataTable(
    ["Uncertainty", "Source", "Type", "Affected subelements", "Importance", "Treatment"],
    mef.integratedUncertainties.map((uncertainty) => [uncertainty.name, uncertainty.sourceSubelement, uncertainty.uncertaintyType, uncertainty.affectedSubelements.join(" / "), uncertainty.importance, uncertainty.propagationOrSensitivityTreatment]),
  ));

  out.push(heading("7. Documentation and Peer Review", HeadingLevel.HEADING_1));
  out.push(para(mef.documentation.peerReviewBasis.methodologyReviewScope), para(mef.documentation.peerReviewBasis.seismicHazardCoverage), para(mef.documentation.peerReviewBasis.seismicCapabilityCoverage), para(mef.documentation.peerReviewBasis.seismicPraCoverage));
  if ((mef.exampleDocuments ?? []).length > 0) {
    out.push(dataTable(
      ["Supporting document", "Type", "Size", "Extracted evidence", "Linked records"],
      (mef.exampleDocuments ?? []).map((document) => [document.name, document.kind, document.sizeLabel, document.extracted, String(document.linked)]),
    ));
  }
  out.push(heading("7.1 Integrated Traceability", HeadingLevel.HEADING_2));
  out.push(dataTable(
    ["Requirement", "Subelement", "Data", "Models", "Results", "Documentation"],
    mef.documentation.traceabilityMatrix.map((link) => [link.requirement, link.subelement, link.dataRefs.join("; "), link.modelRefs.join("; "), link.resultRefs.join("; "), link.documentationRefs.join("; ")]),
  ));

  out.push(heading("8. Supporting-Requirement Conformance", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["SR", "Subelement", "HLR", "Category", "Status", "Evidence"],
    mef.conformanceMatrix.map((row) => [row.sr, row.sr.split("-")[0] ?? "", row.hlr, row.capabilityCategory, row.status.replace(/_/g, " "), row.evidence]),
  ));
  out.push(heading("9. Automated Validation Record", HeadingLevel.HEADING_1));
  out.push(dataTable(
    ["Code", "Severity", "Area", "Finding", "Affected records"],
    validateSeismicPra(mef).map((diagnostic) => [diagnostic.code, diagnostic.severity, diagnostic.area, diagnostic.message, diagnostic.recordRefs.join("; ")]),
  ));
  return out;
}

async function generateSeismicPraReport(mef: SeismicPRA, final: boolean): Promise<void> {
  const report = new Document({ sections: [{ children: buildChildren(mef, final) }] });
  const blob = await Packer.toBlob(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${mef.name} — Seismic PRA${final ? "" : " (draft)"}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { generateSeismicPraReport };
