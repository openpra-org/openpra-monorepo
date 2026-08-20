import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Family = SeismicPRA["seismicPlantResponseAnalysis"]["quantification"]["eventSequenceFamilyQuantifications"][number];

function rounded(value: number): number {
  return Number(value.toPrecision(6));
}

export function populateRiskIntegrationBaseline(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  const isSfr = kind === "sfr";
  const token = kind.toUpperCase();
  const spr = mef.seismicPlantResponseAnalysis;
  const quant = spr.quantification;
  const families = quant.eventSequenceFamilyQuantifications;
  const releaseFamilies = families.filter(
    (family) => family.releaseCategoryRef !== "RC-NO-RELEASE",
  );
  const aggregateReleaseMean = rounded(releaseFamilies.reduce(
    (sum, family) =>
      sum + (family.meanFrequency ?? family.pointEstimateFrequency),
    0,
  ));
  const familyById = new Map(families.map((family) =>
    [family.uuid, family] as const));
  const familyByRef = new Map(families.map((family) =>
    [family.eventSequenceFamilyRef, family] as const));
  const fragilityBySsc = new Map(
    mef.seismicFragilityAnalysis.results.fragilityEvaluations.map(
      (evaluation) => [evaluation.sscRef, evaluation] as const,
    ),
  );
  const inducedFailureBySsc = new Map(
    spr.plantResponseModel.inducedFailures.map((failure) =>
      [failure.sscRef, failure] as const),
  );
  const fieldAction = spr.humanReliabilityModel.humanActions.find((action) =>
    action.controlRoomOrExControlRoom === "EX_CONTROL_ROOM"
      || action.controlRoomOrExControlRoom === "BOTH");
  const damageFamily = familyById.get("ESF-QUANT-DAMAGE")!;
  const combinedFamily = familyById.get("ESF-QUANT-COMBINED")!;
  const shutdownFamily = familyByRef.get("ESF-SEISMIC-SHUTDOWN")
    ?? releaseFamilies[1]!;
  const liquefactionFamily = familyById.get("ESF-QUANT-LIQUEFACTION")
    ?? releaseFamilies.find((family) =>
      family.eventSequenceFamilyRef.includes("LIQUEFACTION"))!;
  const externalFloodFamily =
    familyById.get("ESF-QUANT-EXTERNAL-FLOOD")!;
  const spentFuelFamily = releaseFamilies.find((family) =>
    /spent.?fuel/i.test(family.name)) ?? releaseFamilies[2]!;
  const primaryEquipment = spr.seismicEquipmentListDevelopment.equipment.find(
    (equipment) => equipment.uuid === "SEL-PRIMARY",
  );
  const secondaryEquipment =
    spr.seismicEquipmentListDevelopment.equipment.find(
      (equipment) => equipment.uuid === "SEL-SECONDARY",
    );
  const primaryName = primaryEquipment?.name
    ?? (isSfr ? "Primary sodium pump" : "Main helium circulator");
  const secondaryName = secondaryEquipment?.name
    ?? (isSfr ? "Decay-heat-removal air cooler" : "RCCS cooling panel");
  const riskIntegrationResultRef = "RI-SEISMIC-CONTRIBUTION";

  mef.riskIntegrationBaseline.result = {
    uuid: `SEISMIC-RI-HANDOFF-${token}-2026`,
    name: `${isSfr ? "Generic SFR" : "Generic HTGR"} seismic risk package`,
    modelVersion: `${token}-S-PRA 1.0`,
    plantOperatingStateRefs: [
      ...new Set(spr.initiatingEventIdentification.plantOperatingStateRefs),
    ],
    unitRefs: isSfr
      ? ["SFR-UNIT-1"]
      : ["HTGR-MODULE-1", "HTGR-MODULE-2", "HTGR-MODULE-3", "HTGR-MODULE-4"],
    radioactiveMaterialSourceRefs: [
      ...new Set(spr.plantResponseModel.radioactiveMaterialSourceRefs),
    ],
    initiatingEventRefs: [
      ...new Set([
        ...spr.initiatingEventIdentification.retainedInitiatingEventRefs,
        ...releaseFamilies.flatMap((family) => family.initiatingEventRefs),
      ]),
    ],
    eventSequenceFamilyRefs: families.map((family) =>
      family.eventSequenceFamilyRef),
    releaseCategoryRefs: [
      ...new Set(families.flatMap((family) =>
        family.releaseCategoryRef === undefined
          ? []
          : [family.releaseCategoryRef])),
    ],
    aggregateReleaseFamilyMeanFrequency: aggregateReleaseMean,
    frequencyUnit: "PER_PLANT_YEAR",
    uncertaintyRange: {
      lowerBound: rounded(aggregateReleaseMean * (isSfr ? 0.30 : 0.32)),
      upperBound: rounded(aggregateReleaseMean * (isSfr ? 3.30 : 3.15)),
      confidenceLevel: 0.90,
    },
    internalEventsRiskRef: `RI-${token}-INTERNAL-EVENTS-2026`,
    otherHazardRiskRefs: [
      `RI-${token}-INTERNAL-FIRE-2026`,
      `RI-${token}-INTERNAL-FLOOD-2026`,
      `RI-${token}-OTHER-EXTERNAL-HAZARDS-2026`,
    ],
    overlapTreatment: "Mutually exclusive event-sequence-family and release-category partitions are applied before aggregation. Earthquake-induced internal fire, internal flood, liquefaction, and external flooding remain under their seismic initiators and are excluded from independent-hazard additions for the same plant state.",
    crossHazardIntegrationBasis: "Risk Integration receives the seismic family frequencies, uncertainty, POS, unit, radioactive-material-source, and contributor identifiers. RI combines them with internal events and other hazard results at the plant risk endpoints; the Seismic PRA workbook does not invent an all-hazard total.",
    riskIntegrationResultRef,
    dominantContributorRefs: [
      "CONTRIBUTOR-SECONDARY-SSC",
      "CONTRIBUTOR-PRIMARY-SSC",
      "CONTRIBUTOR-COMBINED-FAMILY",
      "CONTRIBUTOR-REACTOR-BUILDING",
      "CONTRIBUTOR-INTERMEDIATE-HAZARD-BIN",
    ],
    status: "READY_FOR_RISK_INTEGRATION",
    implementsSrs: [
      { sr: "SPR-E4", hlr: "E" },
      { sr: "SPR-E8", hlr: "E" },
      { sr: "SPR-F1", hlr: "F" },
      { sr: "SPR-F2", hlr: "F" },
    ],
  };

  mef.riskIntegrationBaseline.decisions = [
    {
      uuid: "SEISMIC-DECISION-DESIGN-MARGIN",
      name: `Preserve ${secondaryName} seismic margin`,
      decisionType: "DESIGN",
      driverRefs: [
        "CONTRIBUTOR-SECONDARY-SSC",
        "UNC-SPR-FRAGILITY-CAPACITY",
      ],
      affectedSscRefs: ["SEL-SECONDARY"],
      action: isSfr
        ? "Maintain the qualified air-cooler support, fan clearances, protected air path, and alternate passive decay-heat-removal function."
        : "Maintain the qualified RCCS panel and header supports, flow-path clearances, and alternate passive module-cooling capability.",
      owner: "Design engineering",
      duePhase: "Final design and installation turnover",
      disposition: "IMPLEMENT",
      verificationRefs: [
        "FRAGILITY-SECONDARY",
        `EVIDENCE-EQUIPMENT-QUALIFICATION-${token}`,
      ],
      reanalysisRequired: true,
      riskIntegrationResultRef,
      basis: `${secondaryName} is the leading SSC contributor and its complete credited load and flow path controls multiple release families.`,
      implementsSrs: [
        { sr: "SPR-E8", hlr: "E" },
        { sr: "SPR-F2", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-CONFIGURATION",
      name: "Control shared supports and separation",
      decisionType: "CONFIGURATION_CONTROL",
      driverRefs: [
        "CONTRIBUTOR-COMBINED-FAMILY",
        "UNC-SPR-SYSTEM-DEPENDENCY",
        "UNC-SPR-FRAGILITY-CORRELATION",
      ],
      affectedSscRefs: [
        "SEL-PRIMARY",
        "SEL-SECONDARY",
        `SEL-${token}-REACTOR-BUILDING`,
      ],
      action: "Place anchorage, support stiffness, cabinet and cable separation, protected routing, and common structural load paths under configuration control.",
      owner: "Configuration management",
      duePhase: "Construction turnover and plant modifications",
      disposition: "IMPLEMENT",
      verificationRefs: [
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
        "REFINEMENT-CORRELATION",
      ],
      reanalysisRequired: true,
      riskIntegrationResultRef,
      basis: "Shared demand and support dependencies materially affect the combined release family and redundant mitigation functions.",
      implementsSrs: [
        { sr: "SFR-E5", hlr: "E" },
        { sr: "SPR-E6", hlr: "E" },
        { sr: "SPR-F2", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-PROCEDURE",
      name: "Validate seismic field actions",
      decisionType: "PROCEDURE",
      driverRefs: [
        "CONTRIBUTOR-FIELD-ACTION",
        "UNC-SPR-HUMAN-RELIABILITY",
      ],
      affectedSscRefs: ["SEL-SECONDARY"],
      action: "Validate the credited route, timing, cues, lighting, communications, staffing, tools, and aftershock restrictions in the applicable emergency procedures.",
      owner: "Operations and HRA",
      duePhase: "Procedure validation before fuel load",
      disposition: "CONFIRM_PRE_OPERATIONAL",
      verificationRefs: [
        fieldAction?.humanFailureEventRef ?? "HFE-SEISMIC-LOCAL-ACTION",
        `EVIDENCE-PROCEDURES-${token}`,
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
      ],
      reanalysisRequired: true,
      riskIntegrationResultRef,
      basis: "The credited field action remains risk-significant and is valid only for the modeled access, target, timing, and dependency conditions.",
      implementsSrs: [
        { sr: "SPR-D5", hlr: "D" },
        { sr: "SPR-D6", hlr: "D" },
        { sr: "SPR-F2", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-MONITORING",
      name: "Monitor seismic risk controls",
      decisionType: "MONITORING",
      driverRefs: [
        "CONTRIBUTOR-PRIMARY-SSC",
        "CONTRIBUTOR-SECONDARY-SSC",
        "CONTRIBUTOR-LIQUEFACTION",
        "CONTRIBUTOR-EXTERNAL-FLOOD",
      ],
      affectedSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
      action: "Inspect risk-significant anchorage, supports, clearances, drainage, flood barriers, penetration seals, and alternate access routes at turnover and after relevant modifications or seismic events.",
      owner: "Maintenance and plant engineering",
      duePhase: "Pre-operational program and continuing surveillance",
      disposition: "MONITOR",
      verificationRefs: [
        "SECONDARY-LIQUEFACTION",
        "SECONDARY-EXTERNAL-FLOODING",
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
      ],
      reanalysisRequired: false,
      riskIntegrationResultRef,
      basis: "These physical conditions preserve the modeled SSC capacities and the retained secondary-hazard defenses.",
      implementsSrs: [
        { sr: "SFR-D4", hlr: "D" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-DATA",
      name: "Close final site and equipment data",
      decisionType: "DATA_COLLECTION",
      driverRefs: [
        "UNC-SPR-SITE-RESPONSE",
        "UNC-SPR-FRAGILITY-CAPACITY",
        "UNC-SPR-AS-BUILT",
      ],
      affectedSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
      action: "Replace remaining reference-design inputs with final foundation profiles, vendor qualification records, installed anchorage details, routed-service records, and procedure timing evidence.",
      owner: "Seismic integration lead",
      duePhase: "As-built and as-operated confirmation",
      disposition: "CONFIRM_PRE_OPERATIONAL",
      verificationRefs: [
        `EVIDENCE-SITE-INVESTIGATION-${token}`,
        `EVIDENCE-EQUIPMENT-QUALIFICATION-${token}`,
        "PREOP-ASBUILT-WALKDOWN",
      ],
      reanalysisRequired: true,
      riskIntegrationResultRef,
      basis: "The current values are suitable for the pre-operational example but final plant use requires confirmation that installed conditions remain inside the evaluated uncertainty bounds.",
      implementsSrs: [
        { sr: "SPR-E7", hlr: "E" },
        { sr: "SPR-F4", hlr: "F" },
        { sr: "SPR-F5", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-DID",
      name: "Provide seismic inputs to defense-in-depth review",
      decisionType: "DEFENSE_IN_DEPTH_INPUT",
      driverRefs: [
        "CONTRIBUTOR-COMBINED-FAMILY",
        "CONTRIBUTOR-REACTOR-BUILDING",
      ],
      affectedSscRefs: [
        "SEL-PRIMARY",
        "SEL-SECONDARY",
        `SEL-${token}-REACTOR-BUILDING`,
      ],
      action: isSfr
        ? "Forward the passive heat-removal, sodium-boundary, ignition-control, common-structure, and protected-support insights to the plant defense-in-depth evaluation."
        : "Forward the passive module-cooling, multi-module dependency, common-structure, protected-support, and TRISO retention insights to the plant defense-in-depth evaluation.",
      owner: "Risk Integration and defense-in-depth team",
      duePhase: "Plant-level safety evaluation",
      disposition: "FORWARD_TO_PLANT_PROCESS",
      verificationRefs: [
        combinedFamily.eventSequenceFamilyRef,
        riskIntegrationResultRef,
      ],
      reanalysisRequired: false,
      riskIntegrationResultRef,
      basis: "Defense in depth is a plant-level determination using seismic insights together with deterministic barriers, margins, programmatic controls, and all-hazard results.",
      implementsSrs: [
        { sr: "SPR-E8", hlr: "E" },
        { sr: "SPR-F2", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-CLASSIFICATION",
      name: "Provide seismic inputs to SSC classification",
      decisionType: "SSC_CLASSIFICATION_INPUT",
      driverRefs: [
        "CONTRIBUTOR-PRIMARY-SSC",
        "CONTRIBUTOR-SECONDARY-SSC",
        "CONTRIBUTOR-REACTOR-BUILDING",
      ],
      affectedSscRefs: [
        "SEL-PRIMARY",
        "SEL-SECONDARY",
        `SEL-${token}-REACTOR-BUILDING`,
      ],
      action: "Forward the risk-significant functions, failure mechanisms, dependencies, release-family effects, importance results, and uncertainty to the plant SSC-classification process.",
      owner: "Risk Integration and SSC-classification team",
      duePhase: "Plant-level classification evaluation",
      disposition: "FORWARD_TO_PLANT_PROCESS",
      verificationRefs: [
        "FRAGILITY-PRIMARY",
        "FRAGILITY-SECONDARY",
        riskIntegrationResultRef,
      ],
      reanalysisRequired: false,
      riskIntegrationResultRef,
      basis: "The Seismic PRA identifies classification inputs but does not assign plant SSC safety or risk classifications by itself.",
      implementsSrs: [
        { sr: "SPR-E8", hlr: "E" },
        { sr: "SPR-F2", hlr: "F" },
      ],
    },
    {
      uuid: "SEISMIC-DECISION-MODEL-CONTROL",
      name: "Retain exact high-motion quantification",
      decisionType: "MODEL_CONTROL",
      driverRefs: [
        "CONTRIBUTOR-UPPER-HAZARD-BIN",
        "UNC-SPR-RARE-EVENT",
      ],
      affectedSscRefs: [],
      action: "Retain the upper hazard tail, exact Boolean correction for saturated fragilities, mutually exclusive release partitions, and the confirmed integration mesh in future model revisions.",
      owner: "PRA model owner",
      duePhase: "Every Seismic PRA model update",
      disposition: "RETAIN_CURRENT_BASIS",
      verificationRefs: [
        "RARE-EVENT-SATURATED-FRAGILITY",
        "RARE-EVENT-TOTAL-RELEASE",
        "DISCRETIZATION-1",
      ],
      reanalysisRequired: true,
      riskIntegrationResultRef,
      basis: "Removing these controls would overstate overlapping high-motion cutsets or truncate physically relevant risk.",
      implementsSrs: [
        { sr: "SPR-E2", hlr: "E" },
        { sr: "SPR-E3", hlr: "E" },
        { sr: "SPR-F5", hlr: "F" },
      ],
    },
  ];

  function sscTrace(
    uuid: string,
    name: string,
    sscRef: string,
    family: Family,
    decisionRefs: string[],
    humanActionRefs: string[] = [],
  ): SeismicPRA["riskIntegrationBaseline"]["traceabilityPaths"][number] {
    const evaluation = fragilityBySsc.get(sscRef);
    const failure = inducedFailureBySsc.get(sscRef);
    return {
      uuid,
      name,
      evidenceRefs: [
        ...(evaluation?.capacityDataRefs ?? []),
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
      ],
      hazardRefs: [
        "HAZARD-CURVE-MEAN-1HZ",
        "UHS-1E-4-H",
        "SPR-HAZARD-INTERVAL-5",
      ],
      responseRefs: evaluation?.responseResultRefs ?? [],
      sscRefs: [sscRef],
      failureMechanismRefs: evaluation?.mechanismRefs ?? [],
      fragilityRefs: evaluation === undefined ? [] : [evaluation.uuid],
      plantModelRefs: [
        ...(failure === undefined
          ? []
          : [failure.uuid, failure.systemsBasicEventRef]),
        ...family.initiatingEventRefs,
      ],
      humanActionRefs,
      eventSequenceRefs: family.eventSequenceRefs,
      eventSequenceFamilyRef: family.eventSequenceFamilyRef,
      releaseCategoryRef: family.releaseCategoryRef ?? "UNASSIGNED",
      riskIntegrationResultRef,
      decisionRefs,
      status: evaluation !== undefined && failure !== undefined
        ? "PASS"
        : "OPEN",
      openItems: evaluation !== undefined && failure !== undefined
        ? []
        : ["Complete SSC-to-fragility-to-plant-model link"],
    };
  }

  mef.riskIntegrationBaseline.traceabilityPaths = [
    sscTrace(
      "TRACE-SECONDARY-HEAT-REMOVAL",
      `${secondaryName} to release outcome`,
      "SEL-SECONDARY",
      damageFamily,
      [
        "SEISMIC-DECISION-DESIGN-MARGIN",
        "SEISMIC-DECISION-CLASSIFICATION",
      ],
    ),
    sscTrace(
      "TRACE-PRIMARY-CIRCULATING-EQUIPMENT",
      `${primaryName} to release outcome`,
      "SEL-PRIMARY",
      damageFamily,
      [
        "SEISMIC-DECISION-CONFIGURATION",
        "SEISMIC-DECISION-CLASSIFICATION",
      ],
    ),
    sscTrace(
      "TRACE-COMBINED-DEPENDENCY",
      isSfr
        ? "Shared support to sodium release and fire outcome"
        : "Shared support to multi-module release outcome",
      "SEL-SECONDARY",
      combinedFamily,
      [
        "SEISMIC-DECISION-CONFIGURATION",
        "SEISMIC-DECISION-DID",
      ],
    ),
    {
      ...sscTrace(
        "TRACE-LIQUEFACTION",
        "Liquefaction to release outcome",
        "SEL-SECONDARY",
        liquefactionFamily,
        [
          "SEISMIC-DECISION-MONITORING",
          "SEISMIC-DECISION-DID",
        ],
      ),
      hazardRefs: [
        "SECONDARY-LIQUEFACTION",
        "HAZARD-CURVE-MEAN-1HZ",
      ],
      plantModelRefs: [
        "INITIATOR-LIQUEFACTION",
        ...liquefactionFamily.initiatingEventRefs,
      ],
    },
    {
      uuid: "TRACE-EXTERNAL-FLOOD",
      name: "Earthquake-induced external flood to release outcome",
      evidenceRefs: [
        `EVIDENCE-SITE-INVESTIGATION-${token}`,
        "EVIDENCE-SHA-REPORT",
      ],
      hazardRefs: [
        "SECONDARY-EXTERNAL-FLOODING",
        isSfr
          ? "PIONEER-MESA-XF-ANALYSIS-2026"
          : "CEDAR-BASIN-XF-ANALYSIS-2026",
      ],
      responseRefs: [],
      sscRefs: [],
      failureMechanismRefs: [],
      fragilityRefs: [],
      plantModelRefs: [
        "INITIATOR-EXTERNAL-FLOOD",
        ...externalFloodFamily.initiatingEventRefs,
      ],
      humanActionRefs: fieldAction === undefined
        ? []
        : [fieldAction.humanFailureEventRef],
      eventSequenceRefs: externalFloodFamily.eventSequenceRefs,
      eventSequenceFamilyRef: externalFloodFamily.eventSequenceFamilyRef,
      releaseCategoryRef:
        externalFloodFamily.releaseCategoryRef ?? "UNASSIGNED",
      riskIntegrationResultRef,
      decisionRefs: [
        "SEISMIC-DECISION-MONITORING",
        "SEISMIC-DECISION-DID",
      ],
      status: "PASS",
      openItems: [],
    },
    {
      uuid: "TRACE-FIELD-ACTION",
      name: "Seismic field action to release outcome",
      evidenceRefs: [
        `EVIDENCE-PROCEDURES-${token}`,
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
      ],
      hazardRefs: ["SPR-HAZARD-INTERVAL-5"],
      responseRefs: [],
      sscRefs: ["SEL-SECONDARY"],
      failureMechanismRefs: [],
      fragilityRefs: [],
      plantModelRefs: [
        ...(fieldAction?.eventSequenceRefs ?? []),
        shutdownFamily.eventSequenceFamilyRef,
      ],
      humanActionRefs: fieldAction === undefined
        ? []
        : [fieldAction.humanFailureEventRef],
      eventSequenceRefs: shutdownFamily.eventSequenceRefs,
      eventSequenceFamilyRef: shutdownFamily.eventSequenceFamilyRef,
      releaseCategoryRef: shutdownFamily.releaseCategoryRef ?? "UNASSIGNED",
      riskIntegrationResultRef,
      decisionRefs: ["SEISMIC-DECISION-PROCEDURE"],
      status: fieldAction === undefined ? "OPEN" : "PASS",
      openItems: fieldAction === undefined
        ? ["Link the credited field action"]
        : [],
    },
    {
      uuid: "TRACE-SPENT-FUEL",
      name: "Spent-fuel cooling challenge to release outcome",
      evidenceRefs: [
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
        `EVIDENCE-BASELINE-PRA-${token}`,
      ],
      hazardRefs: [
        "HAZARD-CURVE-MEAN-1HZ",
        "SPR-HAZARD-INTERVAL-5",
      ],
      responseRefs: [],
      sscRefs: spr.seismicEquipmentListDevelopment.equipment
        .filter((equipment) => /spent.?fuel/i.test(equipment.name))
        .map((equipment) => equipment.uuid),
      failureMechanismRefs: [],
      fragilityRefs: [],
      plantModelRefs: [...spentFuelFamily.initiatingEventRefs],
      humanActionRefs: [],
      eventSequenceRefs: spentFuelFamily.eventSequenceRefs,
      eventSequenceFamilyRef: spentFuelFamily.eventSequenceFamilyRef,
      releaseCategoryRef: spentFuelFamily.releaseCategoryRef ?? "UNASSIGNED",
      riskIntegrationResultRef,
      decisionRefs: ["SEISMIC-DECISION-DID"],
      status: "PASS",
      openItems: [],
    },
  ];

  mef.riskIntegrationBaseline.baseline = {
    uuid: `SEISMIC-CONTROLLED-BASELINE-${token}-2026`,
    name: `${isSfr ? "Generic SFR" : "Generic HTGR"} Seismic PRA baseline`,
    modelVersion: `${token}-S-PRA 1.0`,
    configurationControlRecordId:
      mef.configurationControlRecordId ?? `CC-SEISMIC-${token}-2026`,
    quantificationRunRef: "REFINEMENT-RUN-4",
    riskIntegrationHandoffRef:
      mef.riskIntegrationBaseline.result.uuid,
    controlledDocumentRefs: [
      "SHA-REPORT-2026",
      "SFR-REPORT-2026",
      "SPR-REPORT-2026",
      "SEISMIC-INTEGRATION-REPORT-2026",
    ],
    peerReviewRef: "SEISMIC-PEER-REVIEW-2026",
    peerReviewStatus: "COMPLETE",
    openFindingRefs: ["PREOP-ASBUILT-WALKDOWN"],
    approvalStatus: "APPROVED",
    approvedBy: "Illustrative Seismic PRA approval board",
    approvalDate: "2026-06-26",
    releaseStatus: "CONTROLLED",
    releaseDate: "2026-06-27",
    scopeLimitations: [
      "Approved only as an illustrative pre-operational example baseline.",
      "Final as-built, as-operated, vendor, procedure, and site confirmation is required before operational application.",
      "Synthetic frequencies and fragilities are not suitable for licensing or safety decisions.",
    ],
    basis: "This controlled example baseline contains the final SHA, SFR, SPR, uncertainty, refinement, traceability, decision, and RI-handoff records. It is loaded into an editable demonstration copy without changing the source baseline status.",
  };

  const reviewEvidence = mef.evidenceRegister.find((record) =>
    record.uuid === "EVIDENCE-PEER-REVIEW-2026");
  if (reviewEvidence !== undefined) {
    reviewEvidence.revision = "Final";
    reviewEvidence.effectiveDate = "2026-06-25";
    reviewEvidence.status = "CONTROLLED";
  }
  mef.documentation.integratedResultsSummary = `The controlled seismic risk package transfers ${releaseFamilies.length} release event-sequence families with an aggregate mean frequency of ${aggregateReleaseMean.toExponential(3)} per plant-year to ${riskIntegrationResultRef}.`;
  mef.documentation.integratedRiskInsights = `${mef.riskIntegrationBaseline.decisions.length} controlled decision records address design, configuration, procedures, monitoring, data closure, defense in depth, SSC classification inputs, and model control.`;
  mef.documentation.traceabilityMatrix.push(
    {
      requirement: "SPR-F2",
      subelement: "SPR",
      dataRefs: mef.riskIntegrationBaseline.result.dominantContributorRefs,
      modelRefs: [
        "DISCRETIZATION-1",
        "SY-SEISMIC-MODEL",
      ],
      resultRefs: releaseFamilies.map((family) => family.uuid),
      documentationRefs: [
        "SPR-REPORT-2026",
        "SEISMIC-INTEGRATION-REPORT-2026",
      ],
    },
    {
      requirement: "SPR-F5",
      subelement: "SPR",
      dataRefs: mef.riskIntegrationBaseline.baseline.scopeLimitations,
      modelRefs: ["REFINEMENT-RUN-4"],
      resultRefs: [mef.riskIntegrationBaseline.result.uuid],
      documentationRefs:
        mef.riskIntegrationBaseline.baseline.controlledDocumentRefs,
    },
  );
  mef.integration.riskIntegrationRefs = [
    riskIntegrationResultRef,
    mef.riskIntegrationBaseline.result.uuid,
  ];

}
