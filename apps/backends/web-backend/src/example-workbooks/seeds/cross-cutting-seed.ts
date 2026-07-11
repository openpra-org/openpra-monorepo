import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import {
  type PRAConfigurationControl,
  type MonitoredChange,
  type PraUpdateRecord,
  type ComputerCodeControl,
} from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import {
  type NewlyDevelopedMethod,
} from "interfaces-mef-types/cross-cutting/newly-developed-methods";

// hardcoded — minimal schema-conformant instances for the cross-cutting workbooks
// referenced by the POS workbook. The POS demo's CC snapshot card reads from
// CC_SNAPSHOT_INSTANCE; the NM chips read from NM_INSTANCES.

const EMPTY_COMMENTS = { comments: [], openCount: 0, resolvedCount: 0 };

function ccMonitored(uuid: string, name: string, type: MonitoredChange["changeType"]): MonitoredChange {
  return {
    uuid,
    name,
    changeType: type,
    description: name,
    detectedAt: "2026-04-10",
    source: "Design configuration register",
    potentialPraImpact: "Pending evaluation",
    status: "OPEN",
    implementsSrs: [{ sr: "POS-CC-A1", hlr: "A" }],
  };
}

function ccPraUpdate(uuid: string, description: string): PraUpdateRecord {
  return {
    uuid,
    description,
    performedAt: "2026-04-18",
    performedBy: "Aakash Patel",
    affectedTechnicalElementIds: ["POS-GENERIC-1"],
    basisForUpdate: "Frozen baseline at Generic-1 design freeze.",
    consistencyWithPlant: "AS_DESIGNED",
    implementsSrs: [{ sr: "POS-CC-B1", hlr: "B" }],
  };
}

function ccCodeControl(uuid: string, codeName: string, version: string): ComputerCodeControl {
  return {
    uuid,
    name: codeName,
    codeName,
    version,
    controlledArtifactPaths: [`${codeName}/${version}`],
    configurationManagementSystem: "git",
    qualificationStatus: "Qualified",
    implementsSrs: [{ sr: "POS-CC-D1", hlr: "D" }],
  };
}

const CC_SNAPSHOT_INSTANCE: PRAConfigurationControl = {
  uuid: "cc-2026.04.18-001",
  name: "Generic-1 design freeze · 2026-04-18",
  type: TechnicalElementTypes.PRA_CONFIGURATION_CONTROL,
  version: "1",
  created: "2026-04-18",
  modified: "2026-04-18",
  owner: "Aakash Patel",
  workflowState: "FINAL",
  workflowHistory: [
    { state: "DRAFT", enteredAt: "2026-04-15", exitedAt: "2026-04-18", actor: "Aakash Patel" },
    { state: "FINAL", enteredAt: "2026-04-18", actor: "Aakash Patel" },
  ],
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: "2026-04-18", schemaVersion: "0.0.1" },
    analysisDate: "2026-04-18",
    analysts: ["Aakash Patel"],
    reviewers: [],
    scope: "Plant design + PRA codes frozen at the Generic-1 freeze date.",
    limitations: [],
    lastModifiedDate: "2026-04-18",
    lastModifiedBy: "Aakash Patel",
  },
  conformanceMatrix: [],
  internalReviewComments: EMPTY_COMMENTS,
  activePeerReviewIds: [],
  activeAuditIds: [],
  freezeDate: "2026-04-18",
  plantConfigurationRevision: "DBD Rev 4",
  monitoredChanges: [
    ccMonitored("cc-mc-1", "Cover-gas vent header re-route", "PLANT_DESIGN"),
    ccMonitored("cc-mc-2", "DRACS commissioning test plan revision", "PRA_TECHNOLOGY"),
  ],
  praUpdateRecords: [ccPraUpdate("cc-up-1", "Initial POS workbook baseline frozen.")],
  pendingChangeAssessments: [
    {
      uuid: "cc-pca-1",
      pendingChangeIds: ["cc-mc-1", "cc-mc-2"],
      individualImpacts: ["Affects POS-06 barrier status", "Affects POS-07 decay-heat credit"],
      cumulativeImpact: "Pending evaluation against current POS workbook.",
      riskApplicationsAffected: ["POS-GENERIC-1"],
      conclusion: "Hold for next configuration freeze cycle.",
      implementsSrs: [{ sr: "POS-CC-C1", hlr: "C" }],
    },
  ],
  computerCodeControls: [
    ccCodeControl("cc-cd-1", "PRAcciolini", "1.2.0"),
    ccCodeControl("cc-cd-2", "XFTA", "2.4.0"),
    ccCodeControl("cc-cd-3", "PRAXIS", "0.8.0"),
    ccCodeControl("cc-cd-4", "DRACS-CFD", "3.1.0"),
    ccCodeControl("cc-cd-5", "MELCOR", "2.2.21"),
    ccCodeControl("cc-cd-6", "SCALE", "6.3.0"),
  ],
  documentation: {
    programDescription: "Section 5 configuration-control program governing the Generic-1 POS workbook lifecycle.",
    changeMonitoringProcess: "Configuration-change registry reviewed weekly.",
    praMaintenanceProcess: "Workbook updates batched per configuration freeze.",
    cumulativeImpactProcess: "Pending-change assessments rolled up before each freeze.",
    codeControlProcess: "Code versions captured in this snapshot; tagged in version control.",
    implementsSrs: [{ sr: "POS-CC-E1", hlr: "E" }],
  },
  invokedPriorToFirstPeerReview: true,
};

function nmInstance(
  uuid: string,
  name: string,
  artifactKind: NewlyDevelopedMethod["artifactKind"],
  workflowState: "DRAFT" | "INTERNAL_TECHNICAL_REVIEW" | "INTERNAL_APPROVAL" | "FINAL",
  elementCode = "POS",
  appliedInId = "POS-GENERIC-1",
): NewlyDevelopedMethod {
  return {
    uuid,
    name,
    type: TechnicalElementTypes.NEWLY_DEVELOPED_METHOD,
    version: "1",
    created: "2026-03-10",
    modified: "2026-04-12",
    owner: "Method authors",
    workflowState,
    workflowHistory: [{ state: "DRAFT", enteredAt: "2026-03-10", actor: "Method authors" }],
    plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: "2026-04-12", schemaVersion: "0.0.1" },
      analysisDate: "2026-04-12",
      analysts: ["Method authors"],
      reviewers: [],
      scope: name,
      limitations: [],
      lastModifiedDate: "2026-04-12",
      lastModifiedBy: "Method authors",
    },
    conformanceMatrix: [],
    internalReviewComments: EMPTY_COMMENTS,
    activePeerReviewIds: [],
    activeAuditIds: [],
    artifactKind,
    introducedAfterFirstPeerReview: false,
    appliedInTechnicalElementIds: [appliedInId],
    scopeAndLimitations: {
      purpose: name,
      scope: elementCode + " workbook usage",
      applicabilityConditions: [],
      limitations: [],
      implementsSrs: [{ sr: "NM-A1", hlr: "A" }],
    },
    engineeringAndScienceBasis: {
      references: [],
      rationale: "Pre-operational evidence base.",
      consistencyWithPurposeAndScope: "Consistent.",
      implementsSrs: [{ sr: "NM-B1", hlr: "B" }],
    },
    methodData: {
      dataKind: "NUMERIC",
      sources: ["Vendor data"],
      analysisApproach: "Curve fit / sampling / framework.",
      applicationApproach: "Apply to " + elementCode + " records.",
      technicalSoundnessBasis: "Pending review.",
      implementsSrs: [{ sr: "NM-C1", hlr: "C" }],
    },
    uncertaintyCharacterization: {
      uncertaintyTypes: ["Aleatory", "Epistemic"],
      modelUncertaintySources: ["Limited pre-op data"],
      associatedAssumptions: ["Bounded by vendor curve"],
      treatmentApproach: "Bounding upper envelope.",
      implementsSrs: [{ sr: "NM-D1", hlr: "D" }],
    },
    resultsQuality: {
      reproducibilityBasis: "Deterministic for fixed inputs.",
      reasonablenessBasis: "Compared against industry benchmarks.",
      consistencyWithAssumptionsAndData: "Consistent.",
      benchmarkComparisons: [],
      implementsSrs: [{ sr: "NM-E1", hlr: "E" }],
    },
    documentation: {
      description: name,
      traceabilityBasis: "Inputs and outputs versioned with this NM record.",
      incorporationGuidance: "Cite this NM record in " + elementCode + " conformance entries.",
      implementsSrs: [{ sr: "NM-F1", hlr: "F" }],
    },
    technicalElementOverlaps: [],
  };
}

const NM_INSTANCES: NewlyDevelopedMethod[] = [
  nmInstance("NM-014", "Decay-heat curve fit for SFR mixed-oxide fuel", "ANALYTICAL_METHOD", "FINAL"),
  nmInstance("NM-021", "Cycle-plan-based duration sampling (pre-op)", "MODELING_TECHNIQUE", "FINAL"),
  nmInstance("NM-028", "Bounding rationale framework for state grouping", "MODELING_TECHNIQUE", "INTERNAL_TECHNICAL_REVIEW"),
  nmInstance("NM-082", "Control-volume transport characterization for mechanistic source terms", "ANALYTICAL_METHOD", "FINAL", "MS", "MS-GENERIC-1"),
  nmInstance("NM-085", "Phenomena-dependency sampling for source-term uncertainty", "MODELING_TECHNIQUE", "FINAL", "MS", "MS-GENERIC-1"),
  nmInstance("NM-088", "Source-to-environment barrier identification framework", "MODELING_TECHNIQUE", "INTERNAL_TECHNICAL_REVIEW", "MS", "MS-GENERIC-1"),
];

function nmById(id: string): NewlyDevelopedMethod | undefined {
  return NM_INSTANCES.find((n) => n.uuid === id);
}

export { CC_SNAPSHOT_INSTANCE, NM_INSTANCES, nmById };
