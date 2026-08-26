import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { createBlankSeismicPra } from "../../seismic-pra-workbooks/blank-seismic-pra";
import { createHazardConditionedMethodModels } from "./hazard-conditioned-method-model-seed";
import { populateFragilityResults } from "./seismic-pra-fragility-results-seed";
import { populateHazardResults } from "./seismic-pra-hazard-results-seed";
import { populateSeismicHumanReliability } from "./seismic-pra-human-reliability-seed";
import { populatePlantResponseModel } from "./seismic-pra-plant-response-seed";
import { populateQuantification } from "./seismic-pra-quantification-seed";
import { populateRiskIntegrationBaseline } from "./seismic-pra-risk-integration-seed";
import { populateRiskInterpretation } from "./seismic-pra-risk-interpretation-seed";
import { populateSelAndResponse } from "./seismic-pra-sel-response-seed";
import { populateSecondaryHazards } from "./seismic-pra-secondary-hazards-seed";
import { populateSiteResponseAnalysis } from "./seismic-pra-site-response-seed";
import { populateThresholdsAndInvestigations } from "./seismic-pra-threshold-investigations-seed";

type ReactorKind = "sfr" | "htgr";
type GroundMotionParameter = SeismicPRA["seismicHazardAnalysis"]["analysisBasis"]["groundMotionParameters"][number];
function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({ sr, hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"] }));
}

export function createSeismicPraExample(kind: ReactorKind): SeismicPRA {
  const isSfr = kind === "sfr";
  const reactor = isSfr ? "Generic SFR" : "Generic HTGR";
  const site = isSfr ? "Pioneer Mesa Site" : "Cedar Basin Site";
  const building = isSfr ? "Reactor and steam-generator building" : "Reactor building and helium service area";
  const mef = createBlankSeismicPra(isSfr ? "S Workbook 2" : "S Workbook 1", "example.preparer");
  mef.hazardConditionedModels = createHazardConditionedMethodModels("S", "Seismic hazard");

  mef.uuid = `SEISMIC-PRA-${kind.toUpperCase()}`;
  mef.created = "2026-06-18T09:00:00.000Z";
  mef.modified = "2026-06-22T15:30:00.000Z";
  mef.praScope = `Full-scope, pre-operational Seismic PRA for the ${reactor}, integrating seismic hazard, fragility, and plant response for all radioactive-material sources and operating states.`;
  mef.metadata.scope = mef.praScope;
  mef.metadata.plantIdentity = {
    name: reactor,
    vendor: "OpenPRA reference design",
    reactorType: isSfr ? "Pool-type sodium-cooled fast reactor" : "Modular high-temperature gas-cooled reactor",
    thermalPower: isSfr ? "840 MWth" : "250 MWth per module",
    primaryCoolant: isSfr ? "Sodium" : "Helium",
    siteName: site,
    numberOfModules: isSfr ? 1 : 4,
  };
  mef.metadata.limitations = [
    "This is an illustrative fictional reference design and site. Hazard curves, fragilities, human-error probabilities, and sequence frequencies are synthetic but internally consistent and are not suitable for licensing or safety decisions.",
    "Reference-design information is used where final as-built data are not yet available.",
  ];
  mef.metadata.reviewers = [
    {
      id: `REVIEWER-${kind.toUpperCase()}-HAZARD`,
      name: "Seismic hazard independent reviewer",
      role: "EXTERNAL_PEER_REVIEWER",
      organization: "Illustrative independent review team",
      title: "Hazard review lead",
      qualification: "SSHAC, PSHA, and site-response review experience",
    },
    {
      id: `REVIEWER-${kind.toUpperCase()}-CAPABILITY`,
      name: "Seismic capability independent reviewer",
      role: "EXTERNAL_PEER_REVIEWER",
      organization: "Illustrative independent review team",
      title: "Fragility review lead",
      qualification: "Nuclear structural response, walkdown, and equipment-fragility experience",
    },
    {
      id: `REVIEWER-${kind.toUpperCase()}-SYSTEMS`,
      name: "Seismic PRA systems independent reviewer",
      role: "EXTERNAL_PEER_REVIEWER",
      organization: "Illustrative independent review team",
      title: "Systems and integration review lead",
      qualification: "Systems analysis, seismic HRA, quantification, and integrated SPRA experience",
    },
  ];
  mef.activePeerReviewIds = ["SEISMIC-PEER-REVIEW-2026"];
  mef.commonAssumptions = [{
    uuid: `ASSUMPTION-${kind.toUpperCase()}-SITE`,
    description: `The selected ${site} profiles bound the final safety-related building footprint.`,
    rationale: "The profile set spans the geotechnical investigation range and is carried as epistemic branches.",
    isPreOperational: true,
    status: "IN_PROGRESS",
    addressingPlans: "Confirm against excavation and foundation acceptance records.",
    limitations: ["Final foundation elevations remain subject to configuration control."],
  }];
  mef.applications = [{
    uuid: `APPLICATION-${kind.toUpperCase()}-BASELINE`,
    name: "Integrated seismic risk baseline",
    purpose: "Provide a consistent seismic risk basis for design, operations, maintenance, emergency planning, and risk-informed decisions.",
    decisionContext: `Pre-operational decisions for the ${reactor}, including risk-significant SSC prioritization and confirmation of design margins.`,
    supportedRiskMetrics: ["Mean event-sequence-family frequency and 5th–95th percentile per plant-year", "Mean release-category frequency per plant-year", "SSC and basic-event importance measures", "Hazard-bin risk contribution"],
    consumingElementRefs: ["RI-SEISMIC-CONTRIBUTION", "SEISMIC-PEER-REVIEW-2026"],
    configurationBasis: `The ${site} hazard, reference-design configuration, SEL revision 2026, and linked SHA/SFR/SPR calculation packages.`,
    limitations: ["Final as-built and as-operated configuration confirmation remains a pre-operational closure item."],
    evidenceRefs: ["EVIDENCE-SHA-REPORT", "EVIDENCE-SFR-CALCS", "EVIDENCE-SEL"],
    status: "ACTIVE",
  }];
  mef.evidenceRegister = [
    {
      uuid: "EVIDENCE-SHA-REPORT",
      name: `${reactor} seismic hazard report`,
      evidenceType: "DOCUMENT",
      sourceReference: "SHA-REPORT-2026",
      revision: "1",
      effectiveDate: "2026-06-18",
      owner: "Hazard team",
      applicableSubelements: ["SHA", "SFR", "SPR"],
      applicability: "Controls the hazard basis, motion definitions, spectra, intervals, and secondary-hazard results transferred downstream.",
      qualityAndLimitations: "Independently checked; final site confirmation remains a tracked pre-operational closure item.",
      fileReference: "DOC-SHA",
      status: "CONTROLLED",
      implementsSrs: srs("SHA-I1", "SHA-I2", "SHA-I3"),
    },
    {
      uuid: "EVIDENCE-SFR-CALCS",
      name: `${reactor} seismic response and fragility calculations`,
      evidenceType: "CALCULATION",
      sourceReference: "SFR-RESPONSE-RESULTS.H5",
      revision: "1",
      effectiveDate: "2026-06-20",
      owner: "Fragility team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Provides response, mechanisms, capacity, fragility curves, uncertainty, and correlation used by the plant-response model.",
      qualityAndLimitations: "Calculation verification is complete; final vendor capacity confirmation remains tracked.",
      fileReference: "DOC-SFR",
      status: "CONTROLLED",
      implementsSrs: srs("SFR-F1", "SFR-F2", "SFR-F3"),
    },
    {
      uuid: "EVIDENCE-SEL",
      name: `${reactor} seismic equipment list`,
      evidenceType: "MODEL",
      sourceReference: "SEL-2026",
      revision: "1",
      effectiveDate: "2026-06-21",
      owner: "Systems and fragility team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Canonical scope and failure-mode register shared by plant response, investigations, fragility, and quantification.",
      qualityAndLimitations: "Multidisciplinary completeness check passed for the reference-design configuration.",
      fileReference: "DOC-SEL",
      status: "CONTROLLED",
      implementsSrs: srs("SFR-A1", "SPR-C1", "SPR-C6"),
    },
  ];
  if (isSfr) {
    mef.evidenceRegister.push(
    {
      uuid: `EVIDENCE-BASELINE-PRA-${kind.toUpperCase()}`,
      name: `${reactor} baseline internal-events PRA model`,
      evidenceType: "MODEL",
      sourceReference: `PRA-${kind.toUpperCase()}-BASELINE-2026.1`,
      revision: "2026.1",
      effectiveDate: "2026-01-15",
      owner: "PRA integration team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Provides the controlled POS, initiating-event, event-sequence, success-criteria, systems, data, and human-reliability records used to identify seismic changes.",
      qualityAndLimitations: "Model export, linked technical-element identifiers, and quantification checks were reconciled; final as-built and as-operated confirmation remains pre-operational.",
      fileReference: `PRA/${kind.toUpperCase()}/BASELINE-2026.1`,
      status: "CONTROLLED",
      implementsSrs: srs("SFR-A1", "SPR-B1"),
    },
    {
      uuid: `EVIDENCE-DESIGN-DRAWINGS-${kind.toUpperCase()}`,
      name: `${reactor} controlled design drawing package`,
      evidenceType: "DOCUMENT",
      sourceReference: `${kind.toUpperCase()}-DESIGN-INDEX-003`,
      revision: "3",
      effectiveDate: "2026-01-22",
      owner: "Plant design engineering",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Provides P&IDs, electrical single-line diagrams, general arrangements, structural drawings, foundation drawings, equipment locations, supports, and routing needed for seismic scope and failure assessment.",
      qualityAndLimitations: "Documents were reconciled to the reference-design index. Final as-built drawings are not yet available for the pre-operational plant.",
      fileReference: `DESIGN/${kind.toUpperCase()}/DRAWING-INDEX-003`,
      status: "CONTROLLED",
      implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1"),
    },
    {
      uuid: `EVIDENCE-SEISMIC-DESIGN-${kind.toUpperCase()}`,
      name: `${reactor} seismic design-basis calculations`,
      evidenceType: "CALCULATION",
      sourceReference: `SDC-${kind.toUpperCase()}-2026-02`,
      revision: "2",
      effectiveDate: "2026-01-28",
      owner: "Structural engineering",
      applicableSubelements: ["SHA", "SFR"],
      applicability: "Provides design spectra, damping, seismic load combinations, structural frequencies, foundation conditions, and design demands used to plan response and fragility evaluations.",
      qualityAndLimitations: "Independent calculation check is complete. Final supplier loads and as-built mass confirmation remain pre-operational.",
      fileReference: `CALC/${kind.toUpperCase()}/SEISMIC-DESIGN-02`,
      status: "CONTROLLED",
      implementsSrs: srs("SFR-B1", "SFR-D1"),
    },
    {
      uuid: `EVIDENCE-EQUIPMENT-QUALIFICATION-${kind.toUpperCase()}`,
      name: `${reactor} equipment seismic qualification register`,
      evidenceType: "DATA",
      sourceReference: `EQ-${kind.toUpperCase()}-REGISTER-REV2`,
      revision: "2",
      effectiveDate: "2026-02-02",
      owner: "Equipment qualification team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Provides test spectra, qualification levels, equipment classes, anchorage conditions, caveats, relay data, and functional acceptance criteria for candidate SEL items.",
      qualityAndLimitations: "Available vendor and class-level records were screened for applicability; final supplier qualification for selected installed items is pending.",
      fileReference: `EQ/${kind.toUpperCase()}/REGISTER-REV2`,
      status: "CONTROLLED",
      implementsSrs: srs("SFR-C1", "SFR-D1", "SFR-E1"),
    },
    {
      uuid: `EVIDENCE-SITE-INVESTIGATION-${kind.toUpperCase()}`,
      name: `${site} geotechnical and geophysical investigation`,
      evidenceType: "DATA",
      sourceReference: `GEOTECH-${kind.toUpperCase()}-REV2`,
      revision: "2",
      effectiveDate: "2025-12-18",
      owner: "Geotechnical engineering",
      applicableSubelements: ["SHA", "SFR"],
      applicability: "Provides site survey control, boring logs, stratigraphy, shear-wave velocity, density, modulus-reduction and damping data, groundwater observations, and foundation recommendations.",
      qualityAndLimitations: "Accepted field and laboratory records cover the reference footprint. Final excavation observations are not yet available.",
      fileReference: `SITE/${kind.toUpperCase()}/GEOTECH-REV2`,
      status: "CONTROLLED",
      implementsSrs: srs("SHA-B1", "SHA-E5", "SFR-B1"),
    },
    {
      uuid: `EVIDENCE-PROCEDURES-${kind.toUpperCase()}`,
      name: `${reactor} operating and maintenance procedure set`,
      evidenceType: "DOCUMENT",
      sourceReference: `PROC-${kind.toUpperCase()}-PREOP-REV1`,
      revision: "Pre-operational 1",
      effectiveDate: "2026-02-08",
      owner: "Plant operations",
      applicableSubelements: ["SPR"],
      applicability: "Provides credited operator actions, indications, access paths, response timing, surveillance activities, maintenance states, and post-earthquake response guidance.",
      qualityAndLimitations: "Draft procedures support the reference operating model; validated as-operated procedures and staffing observations are not yet available.",
      fileReference: `OPS/${kind.toUpperCase()}/PROCEDURES-PREOP-1`,
      status: "DRAFT",
      implementsSrs: srs("SPR-B1", "SPR-D1"),
    },
    {
      uuid: `EVIDENCE-OPERATING-EXPERIENCE-${kind.toUpperCase()}`,
      name: `${reactor} seismic operating-experience review`,
      evidenceType: "REVIEW",
      sourceReference: `OPEX-${kind.toUpperCase()}-SEISMIC-2026-01`,
      revision: "1",
      effectiveDate: "2026-02-12",
      owner: "Systems and human-reliability team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Compiles relevant public seismic event reports, equipment performance observations, interaction lessons, operator-response experience, and technology-specific operating history.",
      qualityAndLimitations: "Search scope, screening criteria, and dispositions were independently checked; direct operating experience for the fictional reference plant is unavailable.",
      fileReference: `OPEX/${kind.toUpperCase()}/SEISMIC-REVIEW-01`,
      status: "CONTROLLED",
      implementsSrs: srs("SFR-D1", "SPR-D1"),
    },
    {
      uuid: `EVIDENCE-WALKDOWN-CONFIG-${kind.toUpperCase()}`,
      name: `${reactor} walkdown and configuration reconciliation`,
      evidenceType: "REVIEW",
      sourceReference: `WALKDOWN-${kind.toUpperCase()}-2026-01`,
      revision: "Pre-operational 0",
      effectiveDate: "2026-02-20",
      owner: "Seismic walkdown team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Records installed or accessible configuration, anchorage, spatial interactions, fire and flood sources, access routes, photographs, drawing reconciliation, and open installation checks.",
      qualityAndLimitations: "Accessible reference-design areas were reviewed; inaccessible, not-yet-installed, and final as-built items require confirmation.",
      fileReference: `WALKDOWN/${kind.toUpperCase()}/ROUND-01`,
      status: "DRAFT",
      implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1"),
    },
    );
  } else {
    mef.evidenceRegister.push(
      {
        uuid: "EVIDENCE-BASELINE-PRA-HTGR",
        name: "MHTGR PRA model basis report",
        evidenceType: "MODEL",
        sourceReference: "DOE-HTGR-86-011, Revision 3, Volume 1",
        revision: "3",
        effectiveDate: "1987-01-01",
        owner: "U.S. Department of Energy / GA Technologies",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Documents the MHTGR PRA scope, initiating events, event trees, sequence quantification, and treatment of earthquake-induced failures used to establish the plant-response model basis.",
        qualityAndLimitations: "Public historical model documentation. The executable PRA database, software version, run controls, and reproducible quantification package are not available in the public source library.",
        fileReference: "DOE-HTGR-86-011, Rev. 3, Vol. 1",
        status: "CONTROLLED",
        implementsSrs: srs("SFR-A1", "SPR-B1"),
      },
      {
        uuid: "EVIDENCE-DESIGN-DRAWINGS-HTGR",
        name: "MHTGR overall plant design specification",
        evidenceType: "DOCUMENT",
        sourceReference: "DOE-HTGR-86004, Revision 9",
        revision: "9",
        effectiveDate: "1990-05-01",
        owner: "Modular HTGR Plant Design Control Office",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Defines the reference plant, design requirements, system functions, classifications, and controlled design basis used to establish Seismic PRA scope.",
        qualityAndLimitations: "The public document contains revision and approval controls for the reference design. It is not a site-specific as-built drawing set or final configuration index.",
        fileReference: "DOE-HTGR-86004, Rev. 9",
        status: "CONTROLLED",
        implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1"),
      },
      {
        uuid: "EVIDENCE-PPIS-SDD-HTGR",
        name: "MHTGR protection and instrumentation system design description",
        evidenceType: "DOCUMENT",
        sourceReference: "DOE-HTGR-86-047, Revision 1",
        revision: "1",
        effectiveDate: "1987-07-01",
        owner: "GA Technologies",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Provides protection-system functions, interfaces, classification, environmental and seismic qualification requirements, and design provisions relevant to failure assessment.",
        qualityAndLimitations: "Controlled reference-design description. It states qualification requirements but does not provide an installed-item qualification register, test report set, or as-built mounting confirmation.",
        fileReference: "DOE-HTGR-86-047, Rev. 1",
        status: "CONTROLLED",
        implementsSrs: srs("SFR-A1", "SFR-C1", "SPR-B1"),
      },
      {
        uuid: "EVIDENCE-RCCS-SDD-HTGR",
        name: "MHTGR reactor cavity cooling system design description",
        evidenceType: "DOCUMENT",
        sourceReference: "DOE-HTGR-87-068",
        revision: "Public issue",
        effectiveDate: "1987-07-01",
        owner: "GA Technologies",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Documents the passive heat-removal system function, requirements, interfaces, quality basis, and reference configuration used when identifying seismic failure effects.",
        qualityAndLimitations: "Public scanned reference-design document. The record does not establish the final installed RCCS configuration, anchorage, supports, or field condition.",
        fileReference: "DOE-HTGR-87-068",
        status: "CONTROLLED",
        implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1"),
      },
      {
        uuid: "EVIDENCE-NRC-REVIEW-HTGR",
        name: "NRC MHTGR preapplication seismic design review",
        evidenceType: "REVIEW",
        sourceReference: "NUREG-1338",
        revision: "Draft preapplication review",
        effectiveDate: "1989-03-01",
        owner: "U.S. Nuclear Regulatory Commission",
        applicableSubelements: ["SHA", "SFR"],
        applicability: "Records the NRC review scope, seismic design criteria, conclusions, and unresolved matters for the public MHTGR reference design.",
        qualityAndLimitations: "Independent public review evidence. It is a draft preapplication safety evaluation and does not replace applicant calculations or demonstrate closure of later site-specific issues.",
        fileReference: "NUREG-1338",
        status: "CONTROLLED",
        implementsSrs: srs("SHA-A1", "SFR-B1"),
      },
      {
        uuid: "EVIDENCE-SEISMIC-DESIGN-HTGR",
        name: "Site-specific seismic design calculations",
        evidenceType: "CALCULATION",
        sourceReference: "Not available for the generic MHTGR reference design",
        owner: "Structural engineering",
        applicableSubelements: ["SHA", "SFR"],
        applicability: "Would provide the site design spectra, damping, load combinations, structural frequencies, foundation conditions, and calculated demands used by response and fragility work.",
        qualityAndLimitations: "No site-specific seismic calculation package exists in the supplied public MHTGR source library. Develop and independently verify it for the selected site before final quantification.",
        status: "DRAFT",
        implementsSrs: srs("SFR-B1", "SFR-D1"),
      },
      {
        uuid: "EVIDENCE-EQUIPMENT-QUALIFICATION-HTGR",
        name: "Installed equipment seismic qualification register",
        evidenceType: "DATA",
        sourceReference: "Not available for the generic MHTGR reference design",
        owner: "Equipment qualification team",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Would link each installed item to its test or analysis basis, qualification spectrum, mounting, caveats, relay data, and functional acceptance criteria.",
        qualityAndLimitations: "The public system descriptions state design requirements, but final supplier records and installed-item qualification evidence are unavailable.",
        status: "DRAFT",
        implementsSrs: srs("SFR-C1", "SFR-D1", "SFR-E1"),
      },
      {
        uuid: "EVIDENCE-SITE-INVESTIGATION-HTGR",
        name: "Site-specific geotechnical and geophysical investigation",
        evidenceType: "DATA",
        sourceReference: "Not available for the generic MHTGR reference design",
        owner: "Geotechnical engineering",
        applicableSubelements: ["SHA", "SFR"],
        applicability: "Would provide survey control, boring logs, stratigraphy, shear-wave velocity, density, dynamic soil properties, groundwater observations, and foundation recommendations.",
        qualityAndLimitations: "The supplied MHTGR records describe a generic reference plant, not the fictional Cedar Basin Site. Site measurements and a qualified site investigation remain required.",
        status: "DRAFT",
        implementsSrs: srs("SHA-B1", "SHA-E5", "SFR-B1"),
      },
      {
        uuid: "EVIDENCE-PROCEDURES-HTGR",
        name: "Validated operating and maintenance procedures",
        evidenceType: "DOCUMENT",
        sourceReference: "Not available for the generic MHTGR reference design",
        owner: "Plant operations",
        applicableSubelements: ["SPR"],
        applicability: "Would define credited operator actions, indications, access paths, timing, surveillance activities, maintenance states, and post-earthquake response.",
        qualityAndLimitations: "The generic MHTGR source library does not contain validated as-operated procedures, staffing observations, or operating records.",
        status: "DRAFT",
        implementsSrs: srs("SPR-B1", "SPR-D1"),
      },
      {
        uuid: "EVIDENCE-WALKDOWN-CONFIG-HTGR",
        name: "As-built seismic walkdown and configuration reconciliation",
        evidenceType: "REVIEW",
        sourceReference: "Not available for the generic MHTGR reference design",
        owner: "Seismic walkdown team",
        applicableSubelements: ["SFR", "SPR"],
        applicability: "Would record installed configuration, anchorage, spatial interactions, fire and flood sources, access routes, photographs, drawing reconciliation, and resolved field observations.",
        qualityAndLimitations: "The MHTGR reference design was not supplied as an operating, accessible plant. No as-built walkdown evidence exists for this example.",
        status: "DRAFT",
        implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1"),
      },
    );
  }

  const baselineModelEvidenceRef = isSfr ? "EVIDENCE-BASELINE-PRA-SFR" : "EVIDENCE-BASELINE-PRA-HTGR";
  const treatmentStatus = (openForHtgr = false): "CONFIRMED" | "OPEN" =>
    !isSfr && openForHtgr ? "OPEN" : "CONFIRMED";
  mef.baselinePra = {
    modelName: isSfr ? "Generic SFR baseline internal-events PRA" : "MHTGR PRA model basis",
    modelReference: isSfr ? "PRA-SFR-BASELINE-2026.1" : "DOE-HTGR-86-011",
    sourceEvidenceRef: baselineModelEvidenceRef,
    revision: isSfr ? "2026.1" : "3",
    freezeDate: isSfr ? "2026-01-15" : "1987-01-01",
    freezeStatus: isSfr ? "FROZEN" : "REFERENCE_ONLY",
    modelBoundary: "Retain applicable baseline operating states, random initiators, event sequences, success criteria, systems, data, and human actions; add only the seismic initiators, failures, dependencies, and quantification logic needed for Seismic PRA.",
    nonSeismicHazardModelRefs: isSfr
      ? ["FIRE-PRA-SFR-2026.1", "INTERNAL-FLOOD-PRA-SFR-2026.1", "EXTERNAL-HAZARDS-PRA-SFR-2026.1", "RI-SFR-2026.1"]
      : ["MHTGR internal-fire model — version not available", "MHTGR internal-flood model — version not available", "MHTGR external-hazards model — version not available", "MHTGR risk-integration model — version not available"],
    recordTreatments: [
      {
        uuid: `BASELINE-${kind.toUpperCase()}-POS`,
        name: "Plant operating states",
        technicalArea: "PLANT_OPERATING_STATES",
        sourceRecordRefs: ["POS"],
        treatment: "REUSED",
        seismicChange: "Use the retained baseline operating states and radioactive-material-source scope without redefining them.",
        owner: "PRA integration",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-IE`,
        name: "Random initiating events",
        technicalArea: "INITIATING_EVENTS",
        sourceRecordRefs: ["IE"],
        treatment: "MODIFIED",
        seismicChange: "Retain applicable random initiators and identify direct seismic and retained secondary-hazard initiators separately.",
        owner: "Plant response",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-ES`,
        name: "Event sequences and end states",
        technicalArea: "EVENT_SEQUENCES",
        sourceRecordRefs: ["ES"],
        treatment: "MODIFIED",
        seismicChange: "Preserve applicable sequence logic and add branches for seismic failures, dependencies, and secondary hazards.",
        owner: "Plant response",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-SC`,
        name: "Success criteria and mission times",
        technicalArea: "SUCCESS_CRITERIA",
        sourceRecordRefs: ["SC"],
        treatment: "MODIFIED",
        seismicChange: "Reconfirm success criteria and mission times for post-earthquake equipment, access, and support conditions.",
        owner: "Systems engineering",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-SY`,
        name: "Systems and support functions",
        technicalArea: "SYSTEMS",
        sourceRecordRefs: ["SY"],
        treatment: "MODIFIED",
        seismicChange: "Retain applicable random failures and add seismic failure modes, correlated failures, and lost support functions.",
        owner: "Systems engineering",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-DA`,
        name: "Reliability data",
        technicalArea: "DATA",
        sourceRecordRefs: ["DA"],
        treatment: "MODIFIED",
        seismicChange: "Retain applicable random-failure data and add hazard, response, fragility, and seismic-correlation parameters.",
        owner: "PRA data",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-HR`,
        name: "Human failure events",
        technicalArea: "HUMAN_RELIABILITY",
        sourceRecordRefs: ["HR"],
        treatment: "MODIFIED",
        seismicChange: "Retain applicable actions but reassess cues, timing, workload, access, communications, and dependencies after an earthquake.",
        owner: "Human reliability",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-FIRE`,
        name: "Internal-fire model",
        technicalArea: "INTERNAL_FIRE",
        sourceRecordRefs: ["F"],
        treatment: "MODIFIED",
        seismicChange: "Use the baseline fire model only for retained earthquake-induced ignition sources and affected fire areas.",
        owner: "Fire PRA",
        status: treatmentStatus(true),
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-FLOOD`,
        name: "Internal-flood model",
        technicalArea: "INTERNAL_FLOOD",
        sourceRecordRefs: ["FL"],
        treatment: "MODIFIED",
        seismicChange: "Use the baseline flood model only for retained seismically failed sources, propagation paths, and affected equipment.",
        owner: "Internal-flood PRA",
        status: treatmentStatus(true),
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-EXTERNAL`,
        name: "External-hazards model",
        technicalArea: "EXTERNAL_HAZARDS",
        sourceRecordRefs: ["XF", "O"],
        treatment: "MODIFIED",
        seismicChange: "Transfer retained earthquake-induced external hazards through controlled interfaces without duplicating their risk.",
        owner: "External hazards",
        status: treatmentStatus(true),
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-RI`,
        name: "Risk-integration model",
        technicalArea: "RISK_INTEGRATION",
        sourceRecordRefs: ["RI"],
        treatment: "MODIFIED",
        seismicChange: "Prepare non-overlapping seismic results for later integration with internal events and other hazards.",
        owner: "Risk integration",
        status: treatmentStatus(true),
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-SEISMIC-FAILURES`,
        name: "Seismic SSC failure logic",
        technicalArea: "SEISMIC_LOGIC",
        sourceRecordRefs: [],
        treatment: "NEW",
        seismicChange: "Create fragility-based SSC failure events, physical failure effects, and justified correlation groups.",
        owner: "Fragility and systems",
        status: "CONFIRMED",
      },
      {
        uuid: `BASELINE-${kind.toUpperCase()}-SEISMIC-QUANT`,
        name: "Hazard-fragility integration",
        technicalArea: "SEISMIC_LOGIC",
        sourceRecordRefs: [],
        treatment: "NEW",
        seismicChange: "Create the seismic hazard-interval and numerical-integration logic used to calculate annual sequence frequencies.",
        owner: "Seismic quantification",
        status: "CONFIRMED",
      },
    ],
    unresolvedInterfaces: isSfr
      ? []
      : [
        "Executable MHTGR PRA database, software version, and reproducible run package",
        "Controlled MHTGR internal-fire and internal-flood model versions",
        "Controlled external-hazards and risk-integration model versions",
      ],
  };

  const sha = mef.seismicHazardAnalysis;
  sha.uuid = `SHA-${kind.toUpperCase()}`;
  sha.praScope = `Site-specific hazard from 1E-2 through 1E-8 annual exceedance, including horizontal and vertical motion and secondary seismic hazards for ${site}.`;
  sha.analysisBasis.site = {
    uuid: `SITE-${kind.toUpperCase()}`,
    name: site,
    siteBasis: "IDENTIFIED_SITE",
    siteName: site,
    location: {
      latitude: isSfr ? 43.186 : 35.642,
      longitude: isSfr ? -116.421 : -112.284,
      elevation: isSfr ? 812 : 1460,
      elevationUnit: "m",
      horizontalDatum: "WGS84",
      verticalDatum: "NAVD88",
    },
    selectionAndApplicabilityBasis: "The defined coordinates, foundation footprint, and geotechnical profiles match the plant configuration used by fragility and response analyses.",
    boundsAllSitesInScope: false,
    boundingDemonstration: "Not applicable. This is an identified-site analysis; measured profile variability is represented in the site-response logic tree.",
    implementsSrs: srs("SHA-A1"),
  };
  sha.analysisBasis.structuredProcess = {
    ...sha.analysisBasis.structuredProcess,
    uuid: `SSHAC-${kind.toUpperCase()}`,
    name: "SSHAC Level 2 hazard study",
    processType: "SSHAC_LEVEL_2",
    processLevelBasis: "The study complexity, available regional models, and intended risk applications support a documented Level 2 process.",
    studyObjective: "Develop technically defensible center, body, and range distributions for seismic sources, ground motion, and site response.",
    participants: [
      {
        uuid: "SHA-PARTICIPANT-PM",
        name: "Hazard project manager",
        organization: "OpenPRA illustrative reference program",
        role: "PROJECT_MANAGER",
        discipline: "INTEGRATION",
        responsibilities: ["Control scope, schedule, records, and quality assurance", "Maintain independence between evaluation and review"],
        qualifications: "Nuclear-project quality assurance and PSHA project-management experience",
        conflictOfInterestEvaluation: "No role conflict identified for the illustrative study",
      },
      {
        uuid: "SHA-PARTICIPANT-TI",
        name: "Technical integrator",
        organization: "OpenPRA illustrative reference program",
        role: "TECHNICAL_INTEGRATOR",
        discipline: "INTEGRATION",
        responsibilities: ["Integrate source, ground-motion, and site-response evaluations", "Document center, body, and range judgments"],
        qualifications: "Senior hazard specialist with SSHAC integration experience",
        conflictOfInterestEvaluation: "No role conflict identified for the illustrative study",
      },
      {
        uuid: "SHA-PARTICIPANT-SSC",
        name: "Seismic-source evaluator",
        organization: "OpenPRA illustrative reference program",
        role: "EVALUATOR_EXPERT",
        discipline: "GEOLOGY",
        responsibilities: ["Evaluate tectonic setting, source geometry, recurrence, and maximum magnitude"],
        qualifications: "Engineering geology, paleoseismology, and seismic-source characterization experience",
        conflictOfInterestEvaluation: "No role conflict identified for the illustrative study",
      },
      {
        uuid: "SHA-PARTICIPANT-GMC",
        name: "Ground-motion evaluator",
        organization: "OpenPRA illustrative reference program",
        role: "EVALUATOR_EXPERT",
        discipline: "STRONG_MOTION",
        responsibilities: ["Evaluate model applicability, component definitions, sigma, and regional residuals"],
        qualifications: "Strong-motion seismology and probabilistic ground-motion modeling experience",
        conflictOfInterestEvaluation: "No role conflict identified for the illustrative study",
      },
      {
        uuid: "SHA-PARTICIPANT-SITE",
        name: "Site-response evaluator",
        organization: "OpenPRA illustrative reference program",
        role: "EVALUATOR_EXPERT",
        discipline: "GEOTECHNICAL",
        responsibilities: ["Evaluate velocity profiles, dynamic properties, nonlinear response, and reference-horizon transfer"],
        qualifications: "Geotechnical earthquake engineering and probabilistic site-response experience",
        conflictOfInterestEvaluation: "No role conflict identified for the illustrative study",
      },
      {
        uuid: "SHA-PARTICIPANT-REVIEW",
        name: "Independent hazard reviewer",
        organization: "Illustrative independent review team",
        role: "PEER_REVIEWER",
        discipline: "INTEGRATION",
        responsibilities: ["Review data completeness, technical judgments, calculations, and traceability"],
        qualifications: "Independent SSHAC, PSHA, and nuclear-site review experience",
        conflictOfInterestEvaluation: "Independent from model development and weighting",
      },
    ],
    activities: [
      {
        uuid: "SHA-ACTIVITY-PLAN",
        name: "Project planning and scope definition",
        activityType: "PLANNING",
        date: "2026-01-08",
        objective: "Confirm the site, PRA applications, motion definitions, calculation limits, roles, and review controls.",
        participants: ["SHA-PARTICIPANT-PM", "SHA-PARTICIPANT-TI", "SHA-PARTICIPANT-REVIEW"],
        inputs: ["PRA-SCOPE-2026", `SITE-${kind.toUpperCase()}`, "ASME-ANS-RA-S-1.4-2021"],
        decisions: ["Use a documented SSHAC Level 2 process for the identified site and intended risk applications."],
        outputs: ["SHA-PROJECT-PLAN-2026", "SHA-DATA-CUTOFF-2026-01-31"],
        recordReference: "SHA-PLANNING-MINUTES-01",
      },
      {
        uuid: "SHA-ACTIVITY-DATA",
        name: "Data compilation and evaluation",
        activityType: "DATA_EVALUATION",
        date: "2026-02-12",
        objective: "Evaluate current regional and site data for quality, applicability, dependence, and gaps.",
        participants: ["SHA-PARTICIPANT-SSC", "SHA-PARTICIPANT-GMC", "SHA-PARTICIPANT-SITE", "SHA-PARTICIPANT-TI"],
        inputs: ["CATALOG-1", "USGS-2023-NSHM", `EARTH-DATA-${kind.toUpperCase()}-STRONG-MOTION`, `EARTH-DATA-${kind.toUpperCase()}-VELOCITY`],
        decisions: ["Retain catalog-completeness, recurrence, path, and site-profile uncertainty for model development."],
        outputs: ["SHA-DATA-EVALUATION-REPORT-2026", "SHA-ALTERNATIVE-HYPOTHESES-REGISTER"],
        recordReference: "SHA-DATA-WORKSHOP-MINUTES-01",
      },
      {
        uuid: "SHA-ACTIVITY-MODEL",
        name: "Source and ground-motion model workshop",
        activityType: "WORKSHOP",
        date: "2026-03-12",
        objective: "Challenge credible alternatives and establish preliminary source and ground-motion weights.",
        participants: ["SHA-PARTICIPANT-TI", "SHA-PARTICIPANT-SSC", "SHA-PARTICIPANT-GMC", "SHA-PARTICIPANT-REVIEW"],
        inputs: ["SHA-ALTERNATIVE-HYPOTHESES-REGISTER", `EARTH-DATA-${kind.toUpperCase()}-STRONG-MOTION`, `SOURCE-MODEL-${kind.toUpperCase()}-2026`],
        decisions: ["Retain four source-model families and four ground-motion model families with conditional applicability."],
        outputs: [`SOURCE-LT-${kind.toUpperCase()}-2026`, `GM-LT-${kind.toUpperCase()}-2026`],
        recordReference: "SHA-MODEL-WORKSHOP-MINUTES-02",
      },
      {
        uuid: "SHA-ACTIVITY-SITE",
        name: "Site-response model development",
        activityType: "MODEL_DEVELOPMENT",
        date: "2026-04-09",
        objective: "Develop weighted velocity, modulus-reduction, damping, and reference-horizon alternatives.",
        participants: ["SHA-PARTICIPANT-TI", "SHA-PARTICIPANT-SITE", "SHA-PARTICIPANT-GMC"],
        inputs: [`EARTH-DATA-${kind.toUpperCase()}-VELOCITY`, `REF-HORIZON-${kind.toUpperCase()}-ROCK`],
        decisions: ["Propagate three measured-profile branches and retain a hard-rock reference-horizon sensitivity."],
        outputs: ["SITE-RESPONSE-METHOD-1", `SITE-AMPLIFICATION-${kind.toUpperCase()}-WEIGHTED`],
        recordReference: "SHA-SITE-RESPONSE-DECISION-01",
      },
      {
        uuid: "SHA-ACTIVITY-INTEGRATE",
        name: "Hazard integration and sensitivity review",
        activityType: "INTEGRATION",
        date: "2026-05-14",
        objective: "Integrate the logic trees and demonstrate center, body, range, numerical stability, and risk-significant uncertainty.",
        participants: ["SHA-PARTICIPANT-TI", "SHA-PARTICIPANT-SSC", "SHA-PARTICIPANT-GMC", "SHA-PARTICIPANT-SITE"],
        inputs: [`SOURCE-LT-${kind.toUpperCase()}-2026`, `GM-LT-${kind.toUpperCase()}-2026`, "SITE-RESPONSE-METHOD-1"],
        decisions: ["Accept converged mean and fractile curves over the selected motion and frequency ranges."],
        outputs: ["SHA-RESULTS-2026.H5", "SHA-SENSITIVITY-REGISTER-2026"],
        recordReference: "SHA-INTEGRATION-MINUTES-03",
      },
      {
        uuid: "SHA-ACTIVITY-REVIEW",
        name: "Independent technical review",
        activityType: "REVIEW",
        date: "2026-06-10",
        objective: "Review implementation, calculations, interfaces, traceability, and open pre-operational limitations.",
        participants: ["SHA-PARTICIPANT-REVIEW"],
        inputs: ["SHA-REPORT-2026", "SHA-RESULTS-2026.H5", "SHA-SENSITIVITY-REGISTER-2026"],
        decisions: ["Accept the illustrative example for demonstration use with the stated non-licensing limitation."],
        outputs: ["SHA-INDEPENDENT-REVIEW-2026"],
        recordReference: "SHA-REVIEW-REPORT-2026",
      },
    ],
    technicalIntegrationApproach: "Repeated evaluation, challenge, feedback, and documented weighting by the technical integrator.",
    evaluationAndIntegrationMethods: "Data sets and models are evaluated for quality, applicability, and dependence before logic-tree integration.",
    centerBodyRangeDemonstration: "Sensitivity cases and branch diagnostics show that the logic trees span credible interpretations and center on the integrator's best estimate.",
    qualityAssuranceProcess: "Independent calculation checks, controlled scripts, peer checking, and traceable workshop records.",
    independentReviewProcess: "An independent hazard reviewer examined inputs, judgments, weights, calculations, and documentation.",
    deviationsAndLimitations: [],
    implementsSrs: srs("SHA-A2"),
  };
  sha.analysisBasis.implementsSrs = srs("SHA-A1", "SHA-A2", "SHA-A3", "SHA-A4", "SHA-A5", "SHA-A6", "SHA-A7");
  // NRC hazard evaluations use spectral control points at 1, 2.5, 5, 10, and
  // 25 Hz plus PGA; 0.5 Hz is retained for low-frequency structural response.
  const spectralFrequenciesHz = [0.5, 1, 2.5, 5, 10, 25] as const;
  const frequencyToken = (frequency: number): string => String(frequency).replace(".", "P");
  const spectralParameter = (
    direction: "GEOMETRIC_MEAN_HORIZONTAL" | "VERTICAL",
    frequency: number,
  ): GroundMotionParameter => {
    const isHorizontal = direction === "GEOMETRIC_MEAN_HORIZONTAL";
    const uuid = isHorizontal && frequency === 1
      ? "GMP-SA-1HZ"
      : `GMP-${isHorizontal ? "H" : "V"}-SA-${frequencyToken(frequency)}HZ`;
    return {
      uuid,
      name: `${isHorizontal ? "Geometric-mean horizontal" : "Vertical"} SA at ${frequency} Hz`,
      parameterType: "SPECTRAL_ACCELERATION",
      direction,
      units: "g",
      dampingRatio: 0.05,
      oscillatorPeriodSeconds: 1 / frequency,
      oscillatorFrequencyHz: frequency,
      componentDefinition: isHorizontal
        ? "Geometric mean of two orthogonal horizontal free-field components at the foundation control point."
        : "Vertical free-field component at the foundation control point.",
      selectedRange: { minimum: 0.005, maximum: isHorizontal ? 3 : 2.5 },
      selectedFrequencyRangeHz: { lower: frequency, upper: frequency },
      usedForHazard: true,
      usedForFragility: true,
      usedForPlantResponse: true,
      consistencyBasis: "The parameter identifier, component definition, damping, units, amplitude range, and frequency are shared by SHA, SFR, and SPR.",
      downstreamElementRefs: ["REFERENCE-EQ-1", "FRAGILITY-PRIMARY", "DISCRETIZATION-1"],
      implementsSrs: srs("SHA-A3", "SHA-A4"),
    };
  };
  const pgaParameter = (direction: "GEOMETRIC_MEAN_HORIZONTAL" | "VERTICAL"): GroundMotionParameter => {
    const isHorizontal = direction === "GEOMETRIC_MEAN_HORIZONTAL";
    return {
      uuid: `GMP-${isHorizontal ? "H" : "V"}-PGA`,
      name: `${isHorizontal ? "Geometric-mean horizontal" : "Vertical"} PGA`,
      parameterType: "PEAK_GROUND_ACCELERATION",
      direction,
      units: "g",
      componentDefinition: isHorizontal
        ? "Geometric mean of two orthogonal horizontal free-field peak accelerations at the foundation control point."
        : "Vertical free-field peak acceleration at the foundation control point.",
      selectedRange: { minimum: 0.005, maximum: isHorizontal ? 2 : 1.5 },
      selectedFrequencyRangeHz: { lower: 100, upper: 100 },
      usedForHazard: true,
      usedForFragility: true,
      usedForPlantResponse: true,
      consistencyBasis: "PGA is represented by the 100 Hz rigid-response control point and shared by SHA, SFR, and SPR.",
      downstreamElementRefs: ["REFERENCE-EQ-1", "FRAGILITY-PRIMARY", "DISCRETIZATION-1"],
      implementsSrs: srs("SHA-A3", "SHA-A4"),
    };
  };
  sha.analysisBasis.groundMotionParameters = [
    ...spectralFrequenciesHz.map((frequency) => spectralParameter("GEOMETRIC_MEAN_HORIZONTAL", frequency)),
    pgaParameter("GEOMETRIC_MEAN_HORIZONTAL"),
    ...spectralFrequenciesHz.map((frequency) => spectralParameter("VERTICAL", frequency)),
    pgaParameter("VERTICAL"),
  ];
  sha.analysisBasis.calculationBounds = {
    maximumGroundMotion: 3,
    groundMotionUnits: "g",
    tailExtrapolationMethod: "Log-linear extrapolation of the terminal three hazard points, checked against branch calculations.",
    truncationImpactEvaluation: "Extending the upper bound to 4 g changes total seismic risk by less than one percent.",
    sequenceRankingUnaffected: true,
    lowerBoundMagnitude: 4.5,
    magnitudeScale: "Mw",
    lowerBoundMagnitudeBasis: "Earthquakes below Mw 4.5 are not expected to damage the engineered SSCs included in the PRA.",
    epsilonLimit: 3,
    epsilonTailTreatment: "Truncated-normal residual with branch sensitivity at epsilon 4.",
    epsilonLimitBasis: "An epsilon-4 sensitivity case confirms that truncation at epsilon 3 adequately represents the aleatory tail in the risk-significant range.",
    implementsSrs: srs("SHA-A5", "SHA-A6", "SHA-A7"),
  };
  sha.earthScienceInputs.dataSets = [
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`,
      name: "Regional tectonic and Quaternary fault mapping",
      discipline: "GEOLOGY",
      sourceOrganization: "U.S. Geological Survey and state geological surveys",
      sourceReference: `SHA-${kind.toUpperCase()}-GEOLOGY-2026`,
      publicationOrAcquisitionDate: "2025-11-14",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional study area to 500 km and mapped Quaternary faults within 200 km",
      temporalCoverage: "Quaternary through present",
      resolution: "1:24,000 locally to 1:250,000 regionally",
      format: "GIS fault traces, geologic maps, and technical reports",
      qualityAndLimitations: "Mapping scale and fault-location uncertainty are retained in alternative source geometries.",
      currentnessAssessment: "Agency releases and map revisions were reviewed through the compilation cutoff.",
      interpretationsSupported: ["Tectonic setting", "fault geometry", "source segmentation"],
      fileReference: "SHA-DATA-ROOM/GEOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-SEISMOLOGY`,
      name: "Historical and instrumental seismicity compilation",
      discipline: "SEISMOLOGY",
      sourceOrganization: "U.S. Geological Survey and regional seismic networks",
      sourceReference: `SHA-${kind.toUpperCase()}-SEISMOLOGY-2026`,
      publicationOrAcquisitionDate: "2026-01-31",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional study area to 500 km",
      temporalCoverage: "1800 through 2026",
      resolution: "Event-level origin, magnitude, and uncertainty",
      format: "Catalog database and reviewed historical-event files",
      qualityAndLimitations: "Pre-instrumental locations and magnitudes carry event-specific or period-dependent uncertainty.",
      currentnessAssessment: "Network catalogs and agency event solutions were reconciled through the cutoff date.",
      interpretationsSupported: ["Recurrence", "seismicity patterns", "source association"],
      fileReference: "SHA-DATA-ROOM/SEISMOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2", "SHA-B5"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOPHYSICS`,
      name: "Crustal geophysics and tectonic framework",
      discipline: "GEOPHYSICS",
      sourceOrganization: "National geophysical data centers and university programs",
      sourceReference: `SHA-${kind.toUpperCase()}-GEOPHYSICS-2025`,
      publicationOrAcquisitionDate: "2025-09-30",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional crustal domain and site vicinity",
      temporalCoverage: "Current interpreted geophysical surveys",
      resolution: "Regional gravity and magnetics with local seismic-refraction constraints",
      format: "Grids, profiles, interpreted horizons, and reports",
      qualityAndLimitations: "Non-unique geophysical interpretations are represented through alternative tectonic models.",
      currentnessAssessment: "Available gravity, magnetic, heat-flow, and crustal-thickness updates were reviewed.",
      interpretationsSupported: ["Crustal structure", "tectonic domains", "regional propagation"],
      fileReference: "SHA-DATA-ROOM/GEOPHYSICS",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOTECHNICAL`,
      name: "Site borings and laboratory material testing",
      discipline: "GEOTECHNICAL",
      sourceOrganization: `${reactor} geotechnical investigation program`,
      sourceReference: `SHA-${kind.toUpperCase()}-GEOTECH-REV2`,
      publicationOrAcquisitionDate: "2025-12-18",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Plant footprint and safety-related building foundations",
      temporalCoverage: "2024 to 2025 field investigation",
      resolution: "Boring and sample intervals to engineering-unit scale",
      format: "Boring logs, laboratory results, and geotechnical data tables",
      qualityAndLimitations: "Final excavation observations remain a pre-operational confirmation item.",
      currentnessAssessment: "Revision 2 includes all accepted borings and laboratory tests available at cutoff.",
      interpretationsSupported: ["Foundation stratigraphy", "material properties", "site-response profiles"],
      fileReference: "SHA-DATA-ROOM/GEOTECHNICAL",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-TOPOGRAPHY`,
      name: "Site topography and surficial geology",
      discipline: "TOPOGRAPHY",
      sourceOrganization: "Plant survey program and state geological survey",
      sourceReference: `SHA-${kind.toUpperCase()}-TOPO-SURFICIAL-2025`,
      publicationOrAcquisitionDate: "2025-10-22",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Site drainage basin and 20 km site vicinity",
      temporalCoverage: "2025 survey surface",
      resolution: "One-meter lidar with field-checked surficial mapping",
      format: "Digital elevation model, contours, and surficial-geology GIS",
      qualityAndLimitations: "Vegetation and planned grading are addressed by field checks and design-surface comparisons.",
      currentnessAssessment: "The latest accepted lidar, grading plan, and geomorphic review are included.",
      interpretationsSupported: ["Topographic response", "surface processes", "secondary-hazard screening"],
      fileReference: "SHA-DATA-ROOM/TOPOGRAPHY",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-PALEO`,
      name: "Paleoseismic fault investigations",
      discipline: "PALEOSEISMOLOGY",
      sourceOrganization: "U.S. Geological Survey, state surveys, and published trench studies",
      sourceReference: `SHA-${kind.toUpperCase()}-PALEO-2025`,
      publicationOrAcquisitionDate: "2025-08-15",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Risk-relevant Quaternary faults within the regional study area",
      temporalCoverage: "Late Quaternary event history",
      resolution: "Event ages, displacement per event, and recurrence intervals",
      format: "Trench logs, chronologic data, slip-rate compilations, and reports",
      qualityAndLimitations: "Sparse event chronologies and dating ranges are retained as epistemic alternatives.",
      currentnessAssessment: "Published investigations and agency fault-database updates were reviewed through cutoff.",
      interpretationsSupported: ["Maximum magnitude", "slip rate", "recurrence", "paleoseismic catalog"],
      fileReference: "SHA-DATA-ROOM/PALEOSEISMOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2", "SHA-B5"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-STRONG-MOTION`,
      name: "Strong-motion recordings and ground-motion database",
      discipline: "STRONG_MOTION",
      sourceOrganization: "National strong-motion programs and peer-reviewed databases",
      sourceReference: `SHA-${kind.toUpperCase()}-STRONG-MOTION-2026`,
      publicationOrAcquisitionDate: "2026-01-20",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Applicable tectonic regions and site-condition ranges",
      temporalCoverage: "1933 through 2025",
      resolution: "Three-component recordings with event, path, and site metadata",
      format: "Processed accelerograms and flatfile metadata",
      qualityAndLimitations: "Sparse near-source records at the highest magnitudes are addressed through model uncertainty.",
      currentnessAssessment: "Accepted database releases and applicable new recordings were screened through cutoff.",
      interpretationsSupported: ["Ground-motion model selection", "regional adjustment", "vertical motion"],
      fileReference: "SHA-DATA-ROOM/STRONG-MOTION",
      implementsSrs: srs("SHA-B1", "SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-VELOCITY`,
      name: "Shear-wave velocity, density, and damping profiles",
      discipline: "GEOTECHNICAL",
      sourceOrganization: `${reactor} site-characterization program`,
      sourceReference: `SHA-${kind.toUpperCase()}-VELOCITY-PROFILES-REV1`,
      publicationOrAcquisitionDate: "2025-12-20",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Reference rock horizon through foundation elevations",
      temporalCoverage: "2024 to 2025 field and laboratory program",
      resolution: "Layer-specific velocity, density, modulus-reduction, and damping data",
      format: "Downhole surveys, surface-wave testing, and laboratory curves",
      qualityAndLimitations: "Spatial variability is represented by weighted lower, best-estimate, and upper profiles.",
      currentnessAssessment: "All accepted field and laboratory results available at cutoff are incorporated.",
      interpretationsSupported: ["Reference horizon", "site-response uncertainty", "foundation input motion"],
      fileReference: "SHA-DATA-ROOM/VELOCITY",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
  ];
  sha.earthScienceInputs.studyRegions = [{
    uuid: "STUDY-REGION-1",
    name: "Regional seismic study area",
    boundaryDescription: "A 500 km regional source study area with focused propagation review within 200 km and local characterization within 50 km.",
    radialExtentKm: 500,
    tectonicSetting: isSfr
      ? "Western Idaho extensional crust influenced by Basin-and-Range deformation and distributed Intermountain seismicity"
      : "Western Colorado Plateau near the Basin-and-Range transition, with active extensional faults and distributed background seismicity",
    includedSourceRegions: ["LOCAL-FAULT-ZONE", "REGIONAL-BACKGROUND"],
    majorContributorCoverageBasis: "Deaggregation confirms all sources contributing more than one percent are within the study region.",
    regionalPropagationDataSufficiency: "Regional strong-motion data are supplemented by applicable NGA data.",
    localSiteEffectsDataSufficiency: "Borehole velocities and laboratory curves support the weighted site profiles.",
    uncertaintyCoverageBasis: "Alternative boundaries and recurrence models are represented in the source logic tree.",
    mapReference: "SHA-MAP-01",
    implementsSrs: srs("SHA-B2", "SHA-B3"),
  }];
  sha.earthScienceInputs.earthquakeCatalog = {
    ...sha.earthScienceInputs.earthquakeCatalog,
    uuid: "CATALOG-1",
    name: "Homogenized earthquake catalog",
    catalogStartDateOrAge: "15 ka BP",
    catalogEndDate: "2026-01-31",
    magnitudeScales: ["Mw", "ML", "mb"],
    homogenizationMethod: "Published regional conversions to Mw with conversion uncertainty retained.",
    declusteringMethod: "Reasenberg declustering with window sensitivity.",
    completenessAssessment: "Stepp-style assessment by magnitude band and source region.",
    locationAndMagnitudeUncertaintyTreatment: "Event-specific uncertainty where available and period-dependent defaults otherwise.",
    duplicateResolutionMethod: "Agency priority hierarchy followed by record-level reconciliation.",
    events: isSfr
      ? [
        { uuid: "EQ-SFR-HIST-1934", recordType: "HISTORICAL", eventDateOrAge: "1934-03-12", locationDescription: "Hansel Valley, Utah earthquake used as a regional normal-faulting analog", magnitude: 6.6, magnitudeScale: "Mw", magnitudeUncertainty: 0.2, sourceReferences: ["USGS-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED", "REGIONAL-ANALOG"] },
        { uuid: "EQ-SFR-HIST-1915", recordType: "HISTORICAL", eventDateOrAge: "1915-10-03", locationDescription: "Pleasant Valley, Nevada earthquake used as a Basin-and-Range normal-faulting analog", magnitude: 7.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.25, sourceReferences: ["USGS-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED", "REGIONAL-ANALOG"] },
        { uuid: "EQ-SFR-INST-1983", recordType: "INSTRUMENTAL", eventDateOrAge: "1983-10-28", locationDescription: "Borah Peak earthquake", magnitude: 6.9, magnitudeScale: "Mw", magnitudeUncertainty: 0.1, depthKm: 16, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-SFR-INST-2020", recordType: "INSTRUMENTAL", eventDateOrAge: "2020-03-31", locationDescription: "Stanley earthquake", magnitude: 6.5, magnitudeScale: "Mw", magnitudeUncertainty: 0.08, depthKm: 12, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-SFR-PALEO-LOCAL", recordType: "PALEOSEISMIC", eventDateOrAge: "6.9 ka BP", locationDescription: "Illustrative Pioneer Mesa local-source trench event", magnitude: 7.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.3, sourceReferences: ["ILLUSTRATIVE-SITE-TRENCH-LOG-PM-01"], qualityFlags: ["AGE-RANGE", "ILLUSTRATIVE-SITE-DATA"] },
        { uuid: "EQ-SFR-PALEO-REGIONAL", recordType: "PALEOSEISMIC", eventDateOrAge: "12 to 15 ka BP", locationDescription: "Illustrative central Idaho regional-source surface-rupture event", magnitude: 6.9, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["ILLUSTRATIVE-REGIONAL-PALEO-COMPILATION"], qualityFlags: ["AGE-RANGE", "ILLUSTRATIVE-SITE-DATA"] },
      ]
      : [
        { uuid: "EQ-HTGR-HIST-1887", recordType: "HISTORICAL", eventDateOrAge: "1887-05-03", locationDescription: "Northern Sonora historical earthquake", magnitude: 7.5, magnitudeScale: "Mw", magnitudeUncertainty: 0.3, sourceReferences: ["USGS-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-HTGR-HIST-1906", recordType: "HISTORICAL", eventDateOrAge: "1906-11-15", locationDescription: "Flagstaff-area historical earthquake", magnitude: 6.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.3, sourceReferences: ["ARIZONA-GEOLOGICAL-SURVEY-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-HTGR-INST-1959", recordType: "INSTRUMENTAL", eventDateOrAge: "1959-08-18", locationDescription: "Hebgen Lake earthquake used as an Intermountain normal-faulting analog", magnitude: 7.2, magnitudeScale: "Mw", magnitudeUncertainty: 0.15, depthKm: 10, depthUncertaintyKm: 3, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED", "REGIONAL-ANALOG"] },
        { uuid: "EQ-HTGR-INST-1992", recordType: "INSTRUMENTAL", eventDateOrAge: "1992-06-28", locationDescription: "Landers earthquake used as a western-US active-crustal analog", magnitude: 7.3, magnitudeScale: "Mw", magnitudeUncertainty: 0.1, depthKm: 8, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED", "REGIONAL-ANALOG"] },
        { uuid: "EQ-HTGR-PALEO-LOCAL", recordType: "PALEOSEISMIC", eventDateOrAge: "4.2 ka BP", locationDescription: "Illustrative Cedar Basin local-source trench event", magnitude: 6.8, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["ILLUSTRATIVE-SITE-TRENCH-LOG-CB-01"], qualityFlags: ["AGE-RANGE", "ILLUSTRATIVE-SITE-DATA"] },
        { uuid: "EQ-HTGR-PALEO-REGIONAL", recordType: "PALEOSEISMIC", eventDateOrAge: "9 to 12 ka BP", locationDescription: "Illustrative plateau-transition regional-source surface-rupture event", magnitude: 7, magnitudeScale: "Mw", magnitudeUncertainty: 0.4, sourceReferences: ["ILLUSTRATIVE-REGIONAL-PALEO-COMPILATION"], qualityFlags: ["AGE-RANGE", "ILLUSTRATIVE-SITE-DATA"] },
      ],
    sourceReferences: isSfr
      ? ["USGS-COMCAT", "USGS-HISTORICAL-CATALOG", "USGS-QUATERNARY-FAULT-DB", "ILLUSTRATIVE-SITE-TRENCH-LOG-PM-01"]
      : ["USGS-COMCAT", "USGS-HISTORICAL-CATALOG", "ARIZONA-GEOLOGICAL-SURVEY-HISTORICAL-CATALOG", "USGS-QUATERNARY-FAULT-DB", "ILLUSTRATIVE-SITE-TRENCH-LOG-CB-01"],
    implementsSrs: srs("SHA-B2", "SHA-B3", "SHA-B5"),
  };
  sha.earthScienceInputs.modelAndMethodInventory = [
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-REGIONAL-SSC`,
      name: "Regional seismic-source characterization model",
      modelKind: "SEISMIC_SOURCE",
      version: "2025.1",
      publicationDate: "2025-10-15",
      sourceReference: `SHA-${kind.toUpperCase()}-SSC-MODEL-2025`,
      applicability: `Defines fault and background-source alternatives for the ${site} study region.`,
      limitations: ["Sparse paleoseismic constraints on selected fault recurrence rates"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls source geometry, recurrence, and maximum-magnitude branches.",
      disposition: "INCLUDED",
      dispositionBasis: "Current data and alternative interpretations are incorporated in the source logic tree.",
      implementsSrs: srs("SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-NATIONAL-UPDATE`,
      name: "National seismic-source model update",
      modelKind: "SEISMIC_SOURCE",
      version: "2025",
      publicationDate: "2025-12-01",
      sourceReference: "NATIONAL-SEISMIC-SOURCE-MODEL-2025",
      applicability: "Provides new regional source boundaries, recurrence parameters, and background seismicity rates.",
      limitations: ["National-scale resolution requires site-region evaluation"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Could change low-frequency hazard and background-source contributions.",
      disposition: "INCLUDED",
      dispositionBasis: "Differences were evaluated and incorporated where they expand the technically defensible range.",
      implementsSrs: srs("SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-GMM`,
      name: "Applicable ground-motion model suite",
      modelKind: "GROUND_MOTION",
      version: "2025.2",
      publicationDate: "2025-11-20",
      sourceReference: `SHA-${kind.toUpperCase()}-GMM-SUITE-2025`,
      applicability: "Covers applicable tectonic regimes, magnitude-distance ranges, and reference-site conditions.",
      limitations: ["Sparse observations at the upper magnitude and motion range"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls median motion, aleatory variability, and epistemic model spread.",
      disposition: "INCLUDED",
      dispositionBasis: "Models pass applicability, independence, and data-support screening.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-PROPAGATION`,
      name: "Regional propagation adjustment model",
      modelKind: "REGIONAL_PROPAGATION",
      version: "1.1",
      publicationDate: "2025-06-30",
      sourceReference: `SHA-${kind.toUpperCase()}-PROPAGATION-1.1`,
      applicability: "Represents path attenuation and crustal effects across the regional study area.",
      limitations: ["Limited recordings for the longest source-to-site paths"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Primarily affects high-frequency motion from regional sources.",
      disposition: "INCLUDED",
      dispositionBasis: "Sensitivity results show a material but bounded effect in risk-significant frequency ranges.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-SITE-RESPONSE`,
      name: "Equivalent-linear site-response method",
      modelKind: "SITE_RESPONSE",
      version: "2024.3",
      publicationDate: "2024-09-12",
      sourceReference: `SHA-${kind.toUpperCase()}-SITE-RESPONSE-2024`,
      applicability: "Calculates one-dimensional response for the weighted site profiles and reference-rock motions.",
      limitations: ["One-dimensional treatment does not explicitly model localized three-dimensional geometry"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls surface amplification, deamplification, and site-response uncertainty.",
      disposition: "INCLUDED",
      dispositionBasis: "Site geometry and sensitivity checks support the selected method for the reference analysis.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-BASIN-SCREEN`,
      name: "Three-dimensional basin-response screening method",
      modelKind: "SITE_RESPONSE",
      version: "2025.1",
      publicationDate: "2025-03-05",
      sourceReference: `SHA-${kind.toUpperCase()}-3D-BASIN-SCREEN-2025`,
      applicability: "Screens whether basin-edge or topographic effects require explicit multidimensional analysis.",
      limitations: ["Screening-level spatial resolution"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Could affect narrow-band amplification if multidimensional effects are significant.",
      disposition: "BOUNDED_BY_EXISTING_MODEL",
      dispositionBasis: "Screening results remain within the weighted site-response profile range.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
  ];
  sha.earthScienceInputs.dataGapAssessment = "No gap was identified that prevents a CC-II hazard analysis; paleoseismic recurrence remains an explicit epistemic uncertainty.";
  sha.earthScienceInputs.subjectMatterExpertReview = "Geology, seismology, geophysics, and geotechnical specialists reviewed data quality and interpretations.";
  sha.earthScienceInputs.compilationCutoffDate = "2026-01-31";
  sha.earthScienceInputs.implementsSrs = srs("SHA-B1", "SHA-B2", "SHA-B3", "SHA-B4", "SHA-B5");
  const earthDataPrefix = `EARTH-DATA-${kind.toUpperCase()}`;
  const sourceModelRef = `SOURCE-MODEL-${kind.toUpperCase()}-2026`;
  const groundMotionParameterRefs = sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid);
  const localSourceId = `SOURCE-${kind.toUpperCase()}-LOCAL-FAULT`;
  const regionalSourceId = `SOURCE-${kind.toUpperCase()}-REGIONAL-FAULT`;
  const backgroundSourceId = `SOURCE-${kind.toUpperCase()}-BACKGROUND`;
  const distalSourceId = `SOURCE-${kind.toUpperCase()}-DISTAL`;
  const localPaleoseismicRefs = isSfr ? ["EQ-SFR-PALEO-LOCAL"] : ["EQ-HTGR-PALEO-LOCAL"];
  const regionalPaleoseismicRefs = isSfr ? ["EQ-SFR-PALEO-REGIONAL"] : ["EQ-HTGR-PALEO-REGIONAL"];
  const instrumentalEventRefs = isSfr
    ? ["EQ-SFR-INST-1983", "EQ-SFR-INST-2020"]
    : ["EQ-HTGR-INST-1959", "EQ-HTGR-INST-1992"];

  sha.sourceCharacterization.structuredApproach = "A SSHAC Level 2 evaluation integrates mapped faults, seismicity, paleoseismic constraints, tectonic analogs, and alternative recurrence models.";
  sha.sourceCharacterization.earthquakeSources = [
    {
      uuid: localSourceId,
      name: isSfr ? "Pioneer Mesa local fault zone" : "Cedar Basin local fault zone",
      sourceType: "FAULT",
      tectonicRegionType: "Active shallow crust",
      active: true,
      faultMechanisms: ["NORMAL", "OBLIQUE"],
      geometry: {
        geometryType: "PLANE",
        geometryDescription: "Segmented fault plane with connected and independent rupture alternatives.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-LOCAL-FAULT-GEOMETRY.gpkg`,
        closestDistanceToSiteKm: isSfr ? 18 : 32,
        depthRangeKm: { minimum: 0, maximum: 18 },
        strikeDegrees: isSfr ? 327 : 342,
        dipDegrees: isSfr ? 52 : 55,
        uncertaintyDescription: "Trace location, dip, down-dip width, and segmentation are represented by coupled geometry branches.",
      },
      magnitudeFrequencyModels: [
        {
          uuid: `MFD-${kind.toUpperCase()}-LOCAL-GR`,
          name: "Truncated Gutenberg-Richter recurrence",
          modelType: "GUTENBERG_RICHTER",
          minimumMagnitude: 4.5,
          maximumMagnitude: isSfr ? 7.4 : 7.25,
          magnitudeScale: "Mw",
          annualRateAboveMinimum: isSfr ? 0.021 : 0.018,
          aValue: isSfr ? 2.18 : 2.1,
          bValue: isSfr ? 0.88 : 0.92,
          parameterDistributions: {
            bValue: { type: DistributionType.NORMAL, mean: isSfr ? 0.88 : 0.92, stdDev: 0.08 },
            maximumMagnitude: { type: DistributionType.UNIFORM, lower: isSfr ? 7.1 : 7, upper: isSfr ? 7.6 : 7.5 },
          },
          dataAndMethodBasis: "Instrumental seismicity, mapped fault dimensions, slip rate, and paleoseismic event ages are jointly evaluated.",
        },
        {
          uuid: `MFD-${kind.toUpperCase()}-LOCAL-RENEWAL`,
          name: "Paleoseismic renewal recurrence",
          modelType: "RENEWAL",
          minimumMagnitude: 6.5,
          maximumMagnitude: isSfr ? 7.5 : 7.3,
          magnitudeScale: "Mw",
          recurrenceIntervalYears: isSfr ? 650 : 950,
          parameterDistributions: {
            recurrenceIntervalYears: { type: DistributionType.LOGNORMAL, median: isSfr ? 650 : 950, errorFactor: 1.6 },
          },
          dataAndMethodBasis: "Elapsed time, event chronology, and slip-per-event constraints define the renewal alternative.",
        },
      ],
      paleoseismicEventRefs: localPaleoseismicRefs,
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-PALEO`],
      majorHazardContributor: true,
      characterizationBasis: "Mapped Quaternary faulting, seismicity, deformation rates, and paleoseismic recurrence constrain the local source.",
      uncertainties: ["Fault segmentation", "down-dip width", "maximum magnitude", "slip rate", "recurrence model"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4"),
    },
    {
      uuid: regionalSourceId,
      name: isSfr ? "Central Idaho extensional source system" : "Colorado Plateau transition source region",
      sourceType: isSfr ? "FAULT" : "AREA",
      tectonicRegionType: "Active shallow crust",
      active: true,
      faultMechanisms: ["NORMAL", "OBLIQUE"],
      geometry: {
        geometryType: isSfr ? "PLANE" : "AREA",
        geometryDescription: isSfr
          ? "Multi-segment normal-fault plane with alternate rupture connectivity."
          : "Distributed active-crustal source region encompassing the nearest Intermountain seismic belt structures.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-REGIONAL-SOURCE-GEOMETRY.gpkg`,
        closestDistanceToSiteKm: isSfr ? 44 : 86,
        depthRangeKm: { minimum: 0, maximum: 22 },
        strikeDegrees: isSfr ? 332 : undefined,
        dipDegrees: isSfr ? 50 : undefined,
        uncertaintyDescription: "Boundary placement, segmentation, seismogenic depth, and activity allocation vary across logic-tree branches.",
      },
      magnitudeFrequencyModels: [
        {
          uuid: `MFD-${kind.toUpperCase()}-REGIONAL-GR`,
          name: "Regional Gutenberg-Richter recurrence",
          modelType: "GUTENBERG_RICHTER",
          minimumMagnitude: 4.5,
          maximumMagnitude: isSfr ? 7.35 : 7.5,
          magnitudeScale: "Mw",
          annualRateAboveMinimum: isSfr ? 0.016 : 0.024,
          aValue: isSfr ? 2.02 : 2.24,
          bValue: isSfr ? 0.9 : 0.96,
          parameterDistributions: {
            bValue: { type: DistributionType.NORMAL, mean: isSfr ? 0.9 : 0.96, stdDev: 0.1 },
          },
          dataAndMethodBasis: "Catalog completeness intervals and geologic deformation rates constrain the regional recurrence model.",
        },
        {
          uuid: `MFD-${kind.toUpperCase()}-REGIONAL-CHAR`,
          name: "Characteristic earthquake alternative",
          modelType: "CHARACTERISTIC",
          minimumMagnitude: 6.7,
          maximumMagnitude: isSfr ? 7.45 : 7.6,
          magnitudeScale: "Mw",
          recurrenceIntervalYears: isSfr ? 1100 : 1450,
          dataAndMethodBasis: "Mapped rupture dimensions and regional fault analogs define the characteristic alternative.",
        },
      ],
      paleoseismicEventRefs: regionalPaleoseismicRefs,
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOPHYSICS`, `${earthDataPrefix}-PALEO`],
      majorHazardContributor: true,
      characterizationBasis: "Regional tectonic framework, catalog seismicity, geophysics, and mapped fault dimensions define the source alternatives.",
      uncertainties: ["Source boundary", "rupture connectivity", "maximum magnitude", "activity rate allocation"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4"),
    },
    {
      uuid: backgroundSourceId,
      name: isSfr ? "Western Idaho background seismicity" : "Cedar Basin transition-zone background seismicity",
      sourceType: "BACKGROUND",
      tectonicRegionType: isSfr ? "Basin and Range active crust" : "Colorado Plateau transition active crust",
      active: true,
      faultMechanisms: isSfr ? ["NORMAL", "OBLIQUE", "UNKNOWN"] : ["STRIKE_SLIP", "NORMAL", "UNKNOWN"],
      geometry: {
        geometryType: "VOLUME",
        geometryDescription: "Smoothed seismicity volume after removal of events assigned to modeled faults.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-BACKGROUND-RATES.nc`,
        closestDistanceToSiteKm: 0,
        depthRangeKm: { minimum: 3, maximum: isSfr ? 24 : 28 },
        uncertaintyDescription: "Smoothing bandwidth, completeness intervals, depth distribution, and fault-event allocation are varied.",
      },
      magnitudeFrequencyModels: [{
        uuid: `MFD-${kind.toUpperCase()}-BACKGROUND-GR`,
        name: "Smoothed-seismicity Gutenberg-Richter model",
        modelType: "GUTENBERG_RICHTER",
        minimumMagnitude: 4.5,
        maximumMagnitude: isSfr ? 6.8 : 6.9,
        magnitudeScale: "Mw",
        annualRateAboveMinimum: isSfr ? 0.034 : 0.019,
        aValue: isSfr ? 2.44 : 2.17,
        bValue: isSfr ? 1.02 : 0.98,
        parameterDistributions: {
          annualRateAboveMinimum: { type: DistributionType.LOGNORMAL, median: isSfr ? 0.034 : 0.019, errorFactor: 1.5 },
        },
        dataAndMethodBasis: "Declustered and completeness-corrected seismicity is smoothed across the seismogenic volume.",
      }],
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOPHYSICS`],
      majorHazardContributor: true,
      characterizationBasis: "Residual catalog seismicity represents earthquakes not assigned to explicit fault sources.",
      uncertainties: ["Catalog completeness", "declustering", "smoothing bandwidth", "maximum magnitude", "depth distribution"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3"),
    },
    {
      uuid: distalSourceId,
      name: isSfr ? "Intermountain distributed source zone" : "Basin-and-Range distal source zone",
      sourceType: "AREA",
      tectonicRegionType: isSfr ? "Volcanic and extensional crust" : "Basin and Range active crust",
      active: true,
      faultMechanisms: isSfr ? ["NORMAL", "UNKNOWN"] : ["REVERSE", "STRIKE_SLIP", "UNKNOWN"],
      geometry: {
        geometryType: "AREA",
        geometryDescription: isSfr
          ? "Regional areal source representing distributed Intermountain and volcanic-plain seismicity."
          : "Regional areal source representing distributed Basin-and-Range seismicity west of the site.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-DISTAL-SOURCE.gpkg`,
        closestDistanceToSiteKm: isSfr ? 68 : 92,
        depthRangeKm: { minimum: 4, maximum: 30 },
        uncertaintyDescription: "Source boundary, seismogenic thickness, activity rate, and maximum magnitude are treated epistemically.",
      },
      magnitudeFrequencyModels: [{
        uuid: `MFD-${kind.toUpperCase()}-DISTAL-GR`,
        name: "Regional distributed-seismicity model",
        modelType: "GUTENBERG_RICHTER",
        minimumMagnitude: 4.5,
        maximumMagnitude: isSfr ? 6.9 : 7.1,
        magnitudeScale: "Mw",
        annualRateAboveMinimum: isSfr ? 0.008 : 0.011,
        aValue: isSfr ? 1.76 : 1.91,
        bValue: isSfr ? 1.05 : 0.99,
        dataAndMethodBasis: "Regional catalog rates and tectonic analogs define the distributed source model.",
      }],
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`],
      majorHazardContributor: !isSfr,
      characterizationBasis: "Regional seismicity and tectonic analogs support a distinct distributed source treatment.",
      uncertainties: ["Source boundary", "activity rate", "maximum magnitude", "ground-motion region assignment"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3"),
    },
  ];
  sha.sourceCharacterization.sourceLogicTree = {
    ...sha.sourceCharacterization.sourceLogicTree,
    uuid: `SOURCE-LT-${kind.toUpperCase()}-2026`,
    name: "Seismic source characterization logic tree",
    nodes: [
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-GEOMETRY`,
        name: "Fault geometry and segmentation",
        nodeKind: "SOURCE_GEOMETRY",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-SEGMENTED`, name: "Segmented ruptures", modelRef: localSourceId, weight: 0.65, technicalBasis: "Mapped discontinuities and paleoseismic event extents favor segmented rupture.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-CONNECTED`, name: "Connected ruptures", modelRef: regionalSourceId, weight: 0.35, technicalBasis: "Structural continuity and regional analogs support a connected-rupture alternative.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`] },
        ],
        weightSum: 1,
        dependencyTreatment: "Geometry selection conditions the maximum-magnitude branches.",
        elicitationBasis: "Technical integrator weighting after evaluator review of mapping and paleoseismic evidence.",
      },
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-MMAX`,
        name: "Maximum magnitude",
        nodeKind: "MAXIMUM_MAGNITUDE",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-MMAX-CENTRAL`, name: "Central maximum magnitude", value: isSfr ? 7.3 : 7.25, weight: 0.6, technicalBasis: "Best-estimate rupture dimensions and regional analogs.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-MMAX-UPPER`, name: "Upper maximum magnitude", value: isSfr ? 7.6 : 7.5, weight: 0.4, technicalBasis: "Connected rupture and broader tectonic analogs define the upper branch.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`] },
        ],
        weightSum: 1,
        parentBranchRef: `SOURCE-BRANCH-${kind.toUpperCase()}-CONNECTED`,
        dependencyTreatment: "The connected geometry branch receives the broader maximum-magnitude range.",
        elicitationBasis: "Fault-dimension scaling and analog evaluations reviewed under the structured process.",
      },
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-RECURRENCE`,
        name: "Recurrence model",
        nodeKind: "RECURRENCE",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-GR`, name: "Catalog Gutenberg-Richter", modelRef: `MFD-${kind.toUpperCase()}-LOCAL-GR`, weight: 0.45, technicalBasis: "Completeness-corrected catalog recurrence.", dataSupport: [`${earthDataPrefix}-SEISMOLOGY`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-RENEWAL`, name: "Paleoseismic renewal", modelRef: `MFD-${kind.toUpperCase()}-LOCAL-RENEWAL`, weight: 0.35, technicalBasis: "Event chronology and elapsed-time constraints.", dataSupport: [`${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-CHAR`, name: "Characteristic recurrence", modelRef: `MFD-${kind.toUpperCase()}-REGIONAL-CHAR`, weight: 0.2, technicalBasis: "Fault dimensions and slip-rate balance.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
        ],
        weightSum: 1,
        dependencyTreatment: "Recurrence branches are evaluated conditionally for explicit faults and background sources.",
        elicitationBasis: "Catalog, paleoseismic, and geologic-rate evidence are weighted by the technical integrator.",
      },
    ],
    totalEndBranchCount: 12,
    branchWeightReview: "Every node sums to one; conditional path weights and end-branch totals were independently checked.",
    dependenciesAndCorrelations: "Geometry, maximum magnitude, and recurrence dependencies are preserved through conditional branching.",
    centerBodyRangeCoverage: "The 12 end branches span segmented and connected geometries, central and upper magnitudes, and three recurrence interpretations.",
    implementsSrs: srs("SHA-C2", "SHA-C3", "SHA-C5"),
  };
  sha.sourceCharacterization.uncertaintyIdentificationMethod = "Data ranking, alternative-hypothesis tables, evaluator challenge, and logic-tree diagnostics identify source uncertainty.";
  sha.sourceCharacterization.existingModelAssessments = [{
    uuid: `SOURCE-ASSESSMENT-${kind.toUpperCase()}-2026`,
    name: "Existing seismic source model update",
    modelType: "SEISMIC_SOURCE",
    modelVersion: "2025.1",
    originalStudyDate: "2025-02-10",
    newDataModelMethodRefs: [`EARTH-SOURCE-${kind.toUpperCase()}-NATIONAL-UPDATE`, `${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`],
    centerBodyRangeCoverageEvaluation: "New fault mapping and recurrence interpretations extend but do not displace the existing center of the model.",
    technicalValidityEvaluation: "The existing regional framework remains valid after source-boundary, rate, and maximum-magnitude comparisons.",
    updateRequired: true,
    updateLevel: "Targeted SSHAC Level 2 update",
    updateMethod: "Revise affected geometry and recurrence branches while retaining validated regional background components.",
    updateJustification: "New mapping and paleoseismic constraints materially refine local and regional source alternatives.",
    resultingModelRef: sourceModelRef,
    implementsSrs: srs("SHA-C4", "SHA-C5"),
  }];
  sha.sourceCharacterization.sourceModelReference = sourceModelRef;
  sha.sourceCharacterization.technicalIntegrationSummary = "Four credible sources, six recurrence models, and 12 weighted end branches represent the source-model center, body, and range.";
  sha.sourceCharacterization.implementsSrs = srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4", "SHA-C5");

  const strongMotionDataRefs = [
    `STRONG-MOTION-${kind.toUpperCase()}-REGIONAL`,
    "STRONG-MOTION-NGA-WEST2",
    "STRONG-MOTION-WUS-NORMAL-FAULT",
  ];
  const groundMotionModelWeights = isSfr
    ? { west: 0.4, national: 0.2, regional: 0.25, simulation: 0.15 }
    : { west: 0.35, national: 0.25, regional: 0.25, simulation: 0.15 };
  const groundMotionModelIds = {
    west: `GMM-${kind.toUpperCase()}-NGA-WEST2`,
    national: `GMM-${kind.toUpperCase()}-USGS-2023-WUS`,
    regional: `GMM-${kind.toUpperCase()}-REGIONAL`,
    simulation: `GMM-${kind.toUpperCase()}-SIMULATION`,
  };

  sha.groundMotionCharacterization.governingMechanisms = isSfr
    ? ["Normal and oblique active-crustal faulting", "Basin and Range background seismicity", "Volcanic-plain distributed seismicity"]
    : ["Normal and oblique active-crustal faulting", "Colorado Plateau transition-zone background seismicity", "Basin-and-Range distributed seismicity"];
  sha.groundMotionCharacterization.historicalAndInstrumentalReview = "Macroseismic observations, regional network recordings, strong-motion records, path attenuation, and site-condition metadata were compared with candidate model residuals.";
  sha.groundMotionCharacterization.strongMotionDataSets = [
    {
      uuid: strongMotionDataRefs[0]!,
      name: `${site} regional strong-motion subset`,
      sourceReference: `${earthDataPrefix}-STRONG-MOTION`,
      tectonicRegions: isSfr
        ? ["Basin and Range active crust", "Intermountain active crust"]
        : ["Colorado Plateau transition crust", "Basin and Range active crust", "Intermountain active crust"],
      magnitudeRange: { minimum: 3.5, maximum: isSfr ? 7.2 : 7.5 },
      distanceRangeKm: { minimum: 8, maximum: 500 },
      siteConditionRange: "Reference rock through firm soil, with measured or inferred Vs30",
      recordCount: isSfr ? 486 : 372,
      componentDefinition: "Three-component records converted to geometric-mean horizontal and vertical components.",
      qualityScreening: "Reviewed event solutions, usable bandwidth, clipping, timing, orientation, and site metadata.",
      useInCalibration: "Evaluates regional residual trends, component conversion, and path-adjustment alternatives.",
    },
    {
      uuid: strongMotionDataRefs[1]!,
      name: "NGA-West2 active-crustal database subset",
      sourceReference: "NGA-WEST2-DATABASE",
      tectonicRegions: ["Active shallow crust"],
      magnitudeRange: { minimum: 3, maximum: 8 },
      distanceRangeKm: { minimum: 0, maximum: 300 },
      siteConditionRange: "Hard rock through soft soil",
      recordCount: 21000,
      componentDefinition: "RotD50-compatible horizontal components with vertical records where available.",
      qualityScreening: "Peer-reviewed flatfile filters, usable-period checks, and removal of records outside model applicability.",
      useInCalibration: "Supports published active-crustal models and checks magnitude, distance, mechanism, and site scaling.",
    },
    {
      uuid: strongMotionDataRefs[2]!,
      name: "Project western-US normal-faulting strong-motion subset",
      sourceReference: "ILLUSTRATIVE-PROJECT-EXTRACT-NGA-WEST2-USGS-2026",
      tectonicRegions: ["Western United States active shallow crust", "Basin and Range active crust", "Intermountain active crust"],
      magnitudeRange: { minimum: 3.5, maximum: 7.4 },
      distanceRangeKm: { minimum: 1, maximum: 400 },
      siteConditionRange: "Hard rock through firm soil with measured or quality-screened inferred Vs30",
      recordCount: 1284,
      componentDefinition: "Three-component records reduced to the project geometric-mean horizontal and vertical definitions.",
      qualityScreening: "Illustrative project extraction applies mechanism, usable-period, clipping, orientation, distance, and site-metadata checks to public western-US records.",
      useInCalibration: "Challenges normal-faulting median and sigma behavior in the NGA-West2 and USGS 2023 western-US model implementations.",
    },
  ];
  sha.groundMotionCharacterization.modelSelectionCriteria = [
    "Tectonic-region and fault-mechanism applicability",
    "Magnitude and distance coverage",
    "Ground-motion parameter and component compatibility",
    "Reference-horizon and site-term compatibility",
    "Usable aleatory sigma model",
    "Independence from other weighted models",
    "Performance against regional strong-motion residuals",
  ];
  sha.groundMotionCharacterization.predictionModels = [
    {
      uuid: groundMotionModelIds.west,
      name: "NGA-West2 active-crustal ensemble",
      modelKind: "PUBLISHED_GMPE",
      version: "2014 with 2025 applicability review",
      sourceReference: "NGA-WEST2-ENSEMBLE",
      tectonicRegionTypes: ["Active shallow crust", "Basin and Range active crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "REVERSE"],
      magnitudeRange: { minimum: 3, maximum: 8.5 },
      distanceRangeKm: { minimum: 0, maximum: 300 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Geometric-mean horizontal motion using model-specific component conversions.",
      siteTermDefinition: "Reference-rock prediction with Vs30-dependent site terms removed before site-response convolution.",
      medianModelDescription: "Weighted active-crustal median with magnitude, distance, mechanism, hanging-wall, and basin terms.",
      aleatoryVariabilityDescription: "Magnitude- and distance-dependent inter-event and intra-event sigma.",
      sigmaComponents: { total: 0.62, interEvent: 0.28, intraEvent: 0.55 },
      extrapolationAndTruncation: "Risk-significant calculations remain within supported ranges; residuals are integrated to epsilon 3.",
      applicabilityAndLimitations: "Primary empirical model for active-crustal sources; common data dependence with the national model suite is accounted for in weighting.",
      calibrationDataRefs: [strongMotionDataRefs[0]!, strongMotionDataRefs[1]!],
      logicTreeWeight: groundMotionModelWeights.west,
      selectionBasis: "Retained for broad data support, mechanism coverage, component compatibility, and regional residual performance.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.national,
      name: "USGS 2023 NSHM western-US ground-motion model suite",
      modelKind: "PUBLISHED_GMPE",
      version: "2023 with 2026 site-applicability review",
      sourceReference: "USGS-2023-NSHM-GROUND-MOTION-WUS",
      tectonicRegionTypes: ["Western United States active shallow crust", "Basin and Range active crust", "Intermountain active crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "REVERSE", "UNKNOWN"],
      magnitudeRange: { minimum: 3, maximum: 8.5 },
      distanceRangeKm: { minimum: 0, maximum: 500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Published western-US horizontal components converted to the project geometric-mean definition.",
      siteTermDefinition: "Western-US reference-rock medians are transferred to the project horizon before probabilistic local site response.",
      medianModelDescription: "The current national western-US logic tree combines active-crustal median models, normal-faulting treatment, basin effects, and epistemic adjustments.",
      aleatoryVariabilityDescription: "Model-specific magnitude-, distance-, and period-dependent sigma is retained with common-data dependence tracked.",
      sigmaComponents: { total: 0.63, interEvent: 0.28, intraEvent: 0.56 },
      extrapolationAndTruncation: "The calculation remains within the evaluated western-US magnitude-distance range and integrates residuals to epsilon 3.",
      applicabilityAndLimitations: "Used as a current national-model comparison; dependence on NGA-West2 data reduces its otherwise independent weight.",
      calibrationDataRefs: [strongMotionDataRefs[0]!, strongMotionDataRefs[2]!],
      logicTreeWeight: groundMotionModelWeights.national,
      selectionBasis: "Retained to reflect the current USGS western-US hazard-model implementation and alternative model weighting.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.regional,
      name: "Project regional empirical adjustment model",
      modelKind: "PROJECT_SPECIFIC_GMPE",
      version: "2026.1",
      sourceReference: `SHA-${kind.toUpperCase()}-REGIONAL-GMM-2026`,
      tectonicRegionTypes: isSfr
        ? ["Basin and Range active crust", "Volcanic and extensional crust"]
        : ["Colorado Plateau transition crust", "Basin and Range active crust", "Active shallow crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "UNKNOWN"],
      magnitudeRange: { minimum: 3.5, maximum: 7.6 },
      distanceRangeKm: { minimum: 5, maximum: 500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Regional records are converted to the common geometric-mean horizontal definition.",
      siteTermDefinition: "Residuals are evaluated at reference-rock conditions and transferred through the site-response model.",
      medianModelDescription: "Published median predictions with period-dependent regional path and stress-drop adjustments.",
      aleatoryVariabilityDescription: "Parent-model sigma is retained with regional residual uncertainty added epistemically.",
      sigmaComponents: { total: 0.64, interEvent: 0.29, intraEvent: 0.57 },
      extrapolationAndTruncation: "Adjustments taper outside the regional data range; the parent models govern unsupported ranges.",
      applicabilityAndLimitations: "Directly represents the site region but has fewer large, nearby recordings than the published databases.",
      calibrationDataRefs: strongMotionDataRefs,
      logicTreeWeight: groundMotionModelWeights.regional,
      selectionBasis: "Retained because statistically significant regional residual trends affect risk-significant frequencies.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.simulation,
      name: "Broadband simulation-informed model",
      modelKind: "HYBRID",
      version: "2026.1",
      sourceReference: `SHA-${kind.toUpperCase()}-BROADBAND-SIM-2026`,
      tectonicRegionTypes: isSfr
        ? ["Basin and Range active crust"]
        : ["Colorado Plateau transition crust", "Basin and Range active crust", "Active shallow crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "REVERSE"],
      magnitudeRange: { minimum: 5, maximum: 8 },
      distanceRangeKm: { minimum: 2, maximum: 500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Synthetic horizontal pairs are reduced to geometric mean and benchmarked against recorded components.",
      siteTermDefinition: "Simulations terminate at the project reference-rock horizon; local response is applied separately.",
      medianModelDescription: "Broadband deterministic and stochastic simulations sample rupture, path, stress drop, and crustal structure.",
      aleatoryVariabilityDescription: "Within-scenario and between-scenario variability are calibrated to empirical sigma.",
      sigmaComponents: { total: 0.6, interEvent: 0.27, intraEvent: 0.54 },
      extrapolationAndTruncation: "Simulation scenarios cover the upper magnitude and near-source range that is sparse in observations.",
      applicabilityAndLimitations: "Provides an independent upper-motion check; crustal-model resolution limits narrow-band interpretation.",
      calibrationDataRefs: strongMotionDataRefs,
      logicTreeWeight: groundMotionModelWeights.simulation,
      selectionBasis: "Retained as an independent model for large-magnitude and near-source behavior.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
  ];
  sha.groundMotionCharacterization.groundMotionLogicTree = {
    ...sha.groundMotionCharacterization.groundMotionLogicTree,
    uuid: `GM-LT-${kind.toUpperCase()}-2026`,
    name: "Ground-motion characterization logic tree",
    nodes: [
      {
        uuid: `GM-LT-${kind.toUpperCase()}-MODEL`,
        name: "Ground-motion model",
        nodeKind: "GROUND_MOTION_MODEL",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-WEST`, name: "Active-crustal ensemble", modelRef: groundMotionModelIds.west, weight: groundMotionModelWeights.west, technicalBasis: "Broad active-crustal database and regional applicability.", dataSupport: [strongMotionDataRefs[0]!, strongMotionDataRefs[1]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-NATIONAL`, name: "USGS 2023 western-US model suite", modelRef: groundMotionModelIds.national, weight: groundMotionModelWeights.national, technicalBasis: "Current national western-US model implementation with explicit dependence adjustment.", dataSupport: [strongMotionDataRefs[0]!, strongMotionDataRefs[2]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-REGIONAL`, name: "Regional empirical adjustment", modelRef: groundMotionModelIds.regional, weight: groundMotionModelWeights.regional, technicalBasis: "Observed regional residual trends.", dataSupport: strongMotionDataRefs },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIM`, name: "Simulation-informed model", modelRef: groundMotionModelIds.simulation, weight: groundMotionModelWeights.simulation, technicalBasis: "Independent large-magnitude and near-source behavior.", dataSupport: strongMotionDataRefs },
        ],
        weightSum: 1,
        dependencyTreatment: "Model branches are applied conditionally by tectonic region and source mechanism.",
        elicitationBasis: "Applicability, independence, data support, and residual performance determine the weights.",
      },
      {
        uuid: `GM-LT-${kind.toUpperCase()}-MEDIAN`,
        name: "Regional median adjustment",
        nodeKind: "OTHER",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-LOW`, name: "Lower median adjustment", value: -0.15, weight: 0.2, technicalBasis: "Lower bound of regional residual uncertainty.", dataSupport: [strongMotionDataRefs[0]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-CENTRAL`, name: "Central median adjustment", value: 0, weight: 0.6, technicalBasis: "Best-estimate residual trend.", dataSupport: [strongMotionDataRefs[0]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-UPPER`, name: "Upper median adjustment", value: 0.15, weight: 0.2, technicalBasis: "Upper bound of regional residual uncertainty.", dataSupport: [strongMotionDataRefs[0]!] },
        ],
        weightSum: 1,
        dependencyTreatment: "Adjustments are period dependent and taper outside the regional data range.",
        elicitationBasis: "Regional mixed-effects residual analysis and evaluator review.",
      },
      {
        uuid: `GM-LT-${kind.toUpperCase()}-SIGMA`,
        name: "Aleatory variability treatment",
        nodeKind: "OTHER",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIGMA-ERGODIC`, name: "Ergodic sigma", value: "Published total sigma", weight: 0.7, technicalBasis: "Supported by the full empirical databases.", dataSupport: [strongMotionDataRefs[1]!, strongMotionDataRefs[2]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIGMA-REDUCED`, name: "Partially non-ergodic sigma", value: "Reduced site-to-site component", weight: 0.3, technicalBasis: "Site-specific residual treatment removes part of the repeatable site term.", dataSupport: [strongMotionDataRefs[0]!] },
        ],
        weightSum: 1,
        dependencyTreatment: "Sigma treatment is correlated across periods and models within each calculation branch.",
        elicitationBasis: "Published sigma decomposition and regional repeatable-site residuals.",
      },
    ],
    totalEndBranchCount: 24,
    branchWeightReview: "All node and conditional model weights sum to one; 24 end-branch weights were independently reconciled.",
    dependenciesAndCorrelations: "Tectonic-region applicability, common database dependence, period correlation, and median-sigma dependence are preserved.",
    centerBodyRangeCoverage: "Four model families, three regional median branches, and two sigma treatments span the defensible motion range.",
    implementsSrs: srs("SHA-D2", "SHA-D3", "SHA-D4"),
  };
  sha.groundMotionCharacterization.referenceHorizons = [
    {
      uuid: `REF-HORIZON-${kind.toUpperCase()}-ROCK`,
      name: "Reference rock horizon",
      horizonType: "ROCK",
      depth: isSfr ? 52 : 34,
      depthUnit: "m",
      shearWaveVelocity: 760,
      shearWaveVelocityUnit: "m/s",
      density: 2200,
      densityUnit: "kg/m3",
      dampingRatio: 0.02,
      definitionBasis: "Borehole velocity logs, density testing, damping measurements, and the foundation geotechnical model.",
      uncertaintyDescription: "Depth, velocity, density, and damping uncertainty are represented by weighted site-profile branches.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
    {
      uuid: `REF-HORIZON-${kind.toUpperCase()}-HARD-ROCK`,
      name: "Hard-rock sensitivity horizon",
      horizonType: "ROCK",
      depth: isSfr ? 96 : 78,
      depthUnit: "m",
      shearWaveVelocity: 2000,
      shearWaveVelocityUnit: "m/s",
      density: 2450,
      densityUnit: "kg/m3",
      dampingRatio: 0.015,
      definitionBasis: "Deep geophysical profiles and regional hard-rock analogs define the alternative input horizon.",
      uncertaintyDescription: "The horizon is used in sensitivity calculations for velocity-gradient and reference-condition uncertainty.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
  ];
  sha.groundMotionCharacterization.processCompatibilityBasis = "The ground-motion process uses the Step 02 SSHAC Level 2 framework, common Mw scale, compatible distance metrics, geometric-mean horizontal motion, and controlled reference horizons.";
  sha.groundMotionCharacterization.uncertainties = [
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-MODEL`,
      name: "Ground-motion model selection",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Alternative empirical and simulation-informed median models span tectonic, magnitude, distance, and mechanism interpretations.",
      affectedModelRefs: Object.values(groundMotionModelIds),
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Weighted model logic tree",
      logicTreeNodeRef: `GM-LT-${kind.toUpperCase()}-MODEL`,
      correlationAndDependencyTreatment: "Common data dependence and tectonic-region applicability are represented conditionally.",
      propagationMethod: "Propagated through all ground-motion logic-tree end branches.",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "Model median differences control hazard across the risk-significant motion range.",
      implementsSrs: srs("SHA-D3", "SHA-D4"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-SIGMA`,
      name: "Aleatory ground-motion variability",
      uncertaintyType: "ALEATORY",
      analysisArea: "GROUND_MOTION",
      description: "Inter-event and intra-event variability depend on magnitude, distance, period, and model family.",
      affectedModelRefs: Object.values(groundMotionModelIds),
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Published sigma models with partially non-ergodic sensitivity treatment",
      correlationAndDependencyTreatment: "Period correlation and common event and site components are retained.",
      propagationMethod: "Integrated to epsilon 3 for every magnitude-distance-source-model combination.",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "The sigma tail materially affects low-frequency exceedance estimates.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-REGIONAL`,
      name: "Regional path adjustment",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Regional attenuation residuals support lower, central, and upper period-dependent median adjustments.",
      affectedModelRefs: [groundMotionModelIds.regional],
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Mixed-effects residual analysis",
      logicTreeNodeRef: `GM-LT-${kind.toUpperCase()}-MEDIAN`,
      correlationAndDependencyTreatment: "Adjustments are correlated across period and taper outside the data range.",
      propagationMethod: "Discrete weighted branches in the ground-motion logic tree.",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Regional attenuation affects high-frequency hazard from the nearest sources.",
      implementsSrs: srs("SHA-D3", "SHA-D4"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-HORIZON`,
      name: "Reference-horizon definition",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Reference depth, shear-wave velocity, density, and damping vary between measured rock and hard-rock sensitivity horizons.",
      affectedModelRefs: [`REF-HORIZON-${kind.toUpperCase()}-ROCK`, `REF-HORIZON-${kind.toUpperCase()}-HARD-ROCK`],
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Alternative reference-horizon sensitivity calculations",
      correlationAndDependencyTreatment: "Horizon selection is coupled to site-response profile and input-motion branches.",
      propagationMethod: "Weighted site-response and reference-motion alternatives.",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Reference-condition uncertainty changes the motion transferred into the site-response analysis.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
  ];
  sha.groundMotionCharacterization.siteToSiteVariabilityIncluded = false;
  sha.groundMotionCharacterization.siteToSiteVariabilityTreatment = "The PRA uses an identified site; repeatable site terms are removed where supported and residual site uncertainty is treated explicitly.";
  sha.groundMotionCharacterization.existingModelAssessments = [{
    uuid: `GMM-ASSESSMENT-${kind.toUpperCase()}-2026`,
    name: "Existing ground-motion model update",
    modelType: "GROUND_MOTION",
    modelVersion: "2025.2",
    originalStudyDate: "2025-04-18",
    newDataModelMethodRefs: [`EARTH-SOURCE-${kind.toUpperCase()}-GMM`, `EARTH-SOURCE-${kind.toUpperCase()}-PROPAGATION`, `${earthDataPrefix}-STRONG-MOTION`],
    centerBodyRangeCoverageEvaluation: "New regional residuals and simulation results remain within the expanded empirical and hybrid model range.",
    technicalValidityEvaluation: "The published model families remain technically valid after component, reference-horizon, and residual comparisons.",
    updateRequired: true,
    updateLevel: "Targeted model and weight update",
    updateMethod: "Add the regional and simulation-informed branches and revise conditional tectonic-region weights.",
    updateJustification: "Regional attenuation and large-magnitude simulation results materially affect selected periods.",
    resultingModelRef: `GROUND-MOTION-MODEL-${kind.toUpperCase()}-2026`,
    implementsSrs: srs("SHA-D2", "SHA-D4"),
  }];
  sha.groundMotionCharacterization.implementsSrs = srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4");

  populateSiteResponseAnalysis(mef, kind, building);

  const spectrumPoints = populateHazardResults(mef, kind, building);
  populateSecondaryHazards(mef, kind);
  sha.documentation.processDescription = "A structured SSHAC Level 2 process develops source, ground-motion, site-response, spectra, and secondary-hazard results for Seismic PRA.";
  sha.documentation.inputsDescription = "Regional and site earth-science data, catalog records, geotechnical investigations, and strong-motion models are controlled and traceable.";
  sha.documentation.modelStructureDescription = "Coupled source, ground-motion, and site-response logic trees are integrated into mean and fractile control-point hazard.";
  sha.documentation.structuredProcessDescription = "Planning, data evaluation, evaluator workshops, model development, technical integration, sensitivity review, and independent review document the technically defensible center, body, and range.";
  sha.documentation.sourceCharacterizationMethods = "Mapped and distributed active-crustal sources use alternative geometry, recurrence, maximum-magnitude, and event-allocation models constrained by the catalog, deformation, geophysics, and illustrative site-specific paleoseismic observations.";
  sha.documentation.groundMotionCharacterizationMethods = "NGA-West2, the USGS 2023 western-US implementation, project regional residuals, and broadband simulations are evaluated on one component and reference-horizon basis with explicit median, sigma, and dependence treatment.";
  sha.documentation.localSiteResponseMethods = "Weighted lower, best-estimate, and upper velocity profiles combine measured density, modulus-reduction, and damping distributions in probabilistic one-dimensional response, with multidimensional and reference-horizon sensitivities.";
  sha.documentation.scientificInterpretations = `The ${site} model treats nearby active faulting, regional distributed seismicity, path attenuation, and nonlinear site response as coupled interpretations rather than fixed values.`;
  sha.documentation.hazardResultsSummary = "Mean curves and spectra cover 1E-2 to below 1E-8 per plant-year and are discretized for response quantification.";
  sha.documentation.secondaryHazardMethods = "Secondary mechanisms are systematically identified, screened, or retained with hazard and fragility interfaces.";
  sha.documentation.riskSignificantUncertaintiesAndAssumptions = "Local-fault recurrence, ground-motion median, and nonlinear site response dominate hazard uncertainty.";
  sha.documentation.modelUncertaintyDocumentation = "Reasonable source, prediction-model, and site-response alternatives are carried in the logic tree or sensitivity studies.";
  sha.documentation.verticalSpectraMethods = "Vertical spectra use hazard-consistent vertical-to-horizontal ratios checked against available vertical recordings and preserve frequency dependence, uncertainty, damping, units, and the common foundation control point.";
  sha.documentation.existingAnalysisEvaluation = "Current source and ground-motion models were compared with the prior regional framework; material mapping, recurrence, path, and simulation updates were incorporated through targeted model and weight revisions.";
  sha.documentation.limitations = [...mef.metadata.limitations];
  sha.documentation.dataAndModelReferences = [
    `SHA-${kind.toUpperCase()}-GEOLOGY-2026`,
    sourceModelRef,
    `SOURCE-LT-${kind.toUpperCase()}-2026`,
    `GM-LT-${kind.toUpperCase()}-2026`,
    "USGS-2023-NSHM",
    "SITE-RESPONSE-METHOD-1",
  ];
  sha.documentation.calculationFileRefs = ["SHA-RESULTS-2026.H5"];
  sha.documentation.reviewRecordRefs = [
    "SHA-DATA-WORKSHOP-MINUTES-01",
    "SHA-MODEL-WORKSHOP-MINUTES-02",
    "SHA-INTEGRATION-MINUTES-03",
    "SHA-REVIEW-REPORT-2026",
  ];
  sha.documentation.traceabilityLinks = [
    {
      uuid: "TRACE-SHA-DATA-RESULT",
      sourceType: "DATA_SET",
      sourceRef: `EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`,
      targetType: "HAZARD_CURVE",
      targetRef: "HAZARD-CURVE-MEAN-1HZ",
      relationship: "The controlled earth-science compilation supports the source, ground-motion, and site-response branches integrated into the mean hazard curve.",
      requirementRefs: srs("SHA-B1", "SHA-C1", "SHA-D1", "SHA-F1"),
    },
    {
      uuid: "TRACE-SHA-RESULT-INTERFACE",
      sourceType: "RESULT",
      sourceRef: "UHS-1E-4-H",
      targetType: "SEISMIC_PRA_INTERFACE",
      targetRef: "IF-SHA-SFR",
      relationship: "The controlled uniform-hazard spectrum, motion definition, and control point are transferred to fragility and plant-response analyses.",
      requirementRefs: srs("SHA-G1", "SHA-G2", "SHA-I2"),
    },
  ];
  sha.documentation.implementsSrs = srs("SHA-A1", "SHA-B1", "SHA-C1", "SHA-D1", "SHA-E1", "SHA-F1", "SHA-G1", "SHA-H1", "SHA-I1");

  const sfr = mef.seismicFragilityAnalysis;
  sfr.uuid = `SFR-${kind.toUpperCase()}`;
  sfr.praScope = `Develop realistic CC-II seismic demands and fragilities for the ${reactor} equipment list over the hazard range of interest.`;
  sfr.scope = {
    seismicEquipmentListRef: "SEL-2026",
    includedSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    excludedSscs: [],
    correlationGroupRefs: ["CORR-COLOCATED-EQUIPMENT"],
    scopeEvolutionSummary: "The scope was reconciled against system logic, seismic initiators, secondary hazards, and walkdown findings.",
    systemsFragilityAlignment: "Every modeled seismic basic event maps to an SEL failure mode and a controlling fragility evaluation.",
    implementsSrs: srs("SFR-A1", "SFR-A2"),
  };
  sfr.seismicResponseAnalysis.hazardSpectrumRefs = ["UHS-1E-4-H"];
  sfr.seismicResponseAnalysis.referenceEarthquakes = [{
    uuid: "REFERENCE-EQ-1",
    name: "Risk-range reference earthquake",
    hazardSpectrumRef: "UHS-1E-4-H",
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    annualFrequencyOfExceedance: 1e-4,
    groundMotionLevel: isSfr ? 0.42 : 0.36,
    groundMotionUnits: "g",
    horizontalComponentRefs: ["UHS-1E-4-H"],
    verticalComponentRef: "VERTICAL-SPECTRUM-1E-4",
    hazardRangeOfInterest: { lowerGroundMotion: 0.1, upperGroundMotion: 1.6, basis: "Contains all intervals contributing materially to seismic risk." },
    riskDominantInputLevel: 0.6,
    selectionMethod: "Hazard-consistent spectrum selected near the geometric center of risk contribution.",
    selectionValidation: "Scaling sensitivities reproduce median response across the hazard range of interest.",
    nonlinearBehaviorBasis: "Potential nonlinearities are modeled or bounded at upper input levels.",
    implementsSrs: srs("SFR-B1", "SFR-B2"),
  }];
  sfr.seismicResponseAnalysis.structuralModels = [{
    uuid: "STRUCTURAL-MODEL-1",
    name: `${building} three-dimensional model`,
    structureRef: "STRUCTURE-REACTOR-BUILDING",
    modelType: "THREE_DIMENSIONAL_FINITE_ELEMENT",
    softwareAndVersion: "OpenStruct 7.2",
    modelFileRefs: ["STRUCT-MODEL-2026"],
    asModeledCondition: "AS_INTENDED_TO_OPERATE",
    stiffnessRepresentation: "Median cracked stiffness with uncertainty sampling.",
    massRepresentation: "Distributed structural mass and explicit equipment mass.",
    dampingRepresentation: "Frequency- and response-level-dependent median damping.",
    stressStateRepresentation: "Gravity and operating prestress included.",
    directionalCoupling: "Three translational directions solved simultaneously.",
    rotationalInertia: "Included for major floors and equipment masses.",
    diaphragmFlexibility: "Shell-element floor diaphragms.",
    torsionalEffects: "Explicit eccentricity and 3-D modes.",
    structuralCoupling: "Shared foundation and adjoining structural interfaces modeled.",
    foundationAndEmbedment: "Embedded foundation with frequency-dependent soil springs.",
    nonlinearFeatures: ["Gap/contact at selected interfaces"],
    modalProperties: [{ mode: 1, frequencyHz: isSfr ? 4.1 : 3.6, dampingRatio: 0.05, direction: "X", massParticipationFraction: 0.62 }],
    verificationAndValidation: "Independent model review, mass/stiffness checks, mode-shape inspection, and benchmark comparison.",
    limitations: ["Final as-built nonstructural mass requires confirmation."],
    implementsSrs: srs("SFR-B2", "SFR-B3"),
  }];
  sfr.seismicResponseAnalysis.responseResults = [{
    uuid: "RESPONSE-PRIMARY-LOCATION",
    name: "Median floor response at primary SSC location",
    responseModelRef: "STRUCTURAL-MODEL-1",
    referenceEarthquakeRef: "REFERENCE-EQ-1",
    location: `${building}, primary equipment elevation`,
    responseQuantity: "FLOOR_RESPONSE_SPECTRUM",
    direction: "COMBINED",
    units: "g",
    spectrumPoints: spectrumPoints.map((point) => ({ frequencyHz: point.frequencyHz, periodSeconds: point.periodSeconds, medianResponse: point.spectralAcceleration * 1.25 })),
    betaRandomness: 0.24,
    betaUncertainty: 0.31,
    compositeBeta: 0.392,
    variabilityBasis: "Input motion, damping, frequency, stiffness, and soil properties are separated into aleatory and epistemic contributions.",
    applicableSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    outputFileRef: "SFR-RESPONSE-RESULTS.H5",
    implementsSrs: srs("SFR-B3", "SFR-B4"),
  }];
  sfr.seismicResponseAnalysis.soilStructureInteractionAnalyses = [{
    uuid: "SSI-1",
    name: "Probabilistic soil-structure interaction",
    applicable: true,
    significanceAssessment: "SSI shifts dominant frequencies and materially affects response uncertainty.",
    analysisType: "PROBABILISTIC",
    method: "Substructure frequency-domain SSI",
    siteSpecific: true,
    soilProfileRefs: ["PROFILE-BEST"],
    strainCompatibleProperties: true,
    embedmentTreatment: "Sidewall and basemat interaction included.",
    groundMotionIncoherenceTreatment: "Wave-passage and incoherence sensitivity included.",
    structureSoilStructureInteractionTreatment: "Common soil domain represented through coupled impedance terms.",
    medianResponseResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    uncertaintyResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    exclusionOrMethodBasis: "Site-specific SSI is retained because flexible profiles overlap structural frequencies.",
    implementsSrs: srs("SFR-B3", "SFR-B5"),
  }];
  sfr.seismicResponseAnalysis.probabilisticSimulations = [{
    uuid: "RESPONSE-SIM-1",
    name: "Probabilistic response simulation",
    method: "LATIN_HYPERCUBE",
    simulationCount: 200,
    randomSeed: 19421,
    inputMotionSetCount: 30,
    componentsPerSet: 3,
    sampledAleatoryVariables: ["input motion record", "damping"],
    sampledEpistemicVariables: ["soil profile", "stiffness", "SSI impedance"],
    correlationTreatment: "Within-structure stiffness and damping correlations are preserved.",
    convergenceMetric: "Median and logarithmic standard deviation at risk-significant spectral ordinates.",
    convergenceCriterion: "Less than two-percent change over the last 50 simulations.",
    convergenceResults: [{ sampleCount: 150, metricValue: 0.019 }, { sampleCount: 200, metricValue: 0.011 }],
    stableResponsesDemonstrated: true,
    outputResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    implementsSrs: srs("SFR-B5", "SFR-B6"),
  }];
  sfr.seismicResponseAnalysis.groundMotionParameterConsistency = "Reference-earthquake motion matches the SHA geometric-mean horizontal SA definition and g units.";
  sfr.seismicResponseAnalysis.controlPointConsistency = "Foundation input and response transfer use CONTROL-POINT-FOUNDATION.";
  sfr.seismicResponseAnalysis.timeHistoryDevelopmentBasis = "Hazard-consistent three-component suites preserve component correlation and spectral variability.";
  sfr.seismicResponseAnalysis.medianCentered = true;
  sfr.seismicResponseAnalysis.approximationBiasAssessment = "Scaling and numerical approximations introduce less than five-percent median bias across the HROI.";
  sfr.seismicResponseAnalysis.implementsSrs = srs("SFR-B1", "SFR-B2", "SFR-B3", "SFR-B4", "SFR-B5", "SFR-B6");
  sfr.documentation.processDescription = "Reference-earthquake structural response, threshold screening, investigations, mechanism evaluation, and lognormal fragility development are integrated with systems modeling.";
  sfr.documentation.inputsDescription = "SHA spectra and intervals, structural and geotechnical models, qualification data, system failure modes, and walkdown evidence.";
  sfr.documentation.seismicResponseAnalysis = "Median-centered 3-D response and SSI simulations propagate aleatory and epistemic response variability.";
  sfr.documentation.ruggedAndThresholdMethodology = "Ruggedness and cumulative threshold methods include anchorage, supports, caveats, correlations, and final model confirmation.";
  sfr.documentation.investigationProcedures = "Risk-informed computerized walkdown and document review cover all SEL items and relevant interactions.";
  sfr.documentation.investigationTeamAndQualifications = "The illustrative team combines seismic walkdown leadership, structural and geotechnical engineers, equipment-capability specialists, systems analysts, fire and flood specialists, and plant-operations reviewers; independent reviewers cover response, anchorage, mechanisms, capacity, uncertainty, and model transfer.";
  sfr.documentation.investigationObservationsAndConclusions = "Investigations confirm credited load paths and anchorage where supported, identify interaction and secondary-hazard sources requiring explicit modeling, and retain pre-operational confirmation items for inaccessible or not-yet-installed SSCs.";
  sfr.documentation.designDocumentReview = "Controlled structural drawings, equipment specifications, qualification records, anchorage calculations, piping and cable-routing information, fire and flood source records, and systems-model failure effects are reconciled to each SEL item and failure mode.";
  sfr.documentation.failureMechanismIdentification = "Controlling functional, structural, anchorage, relay-chatter, soil, fire-source, and flood-source mechanisms are selected from demand-capacity screening, investigations, qualification evidence, and systems failure effects.";
  sfr.documentation.capacityEvaluationMethods = "Median capacities combine test or qualification evidence, code and drawing calculations, anchorage and support capacity, in-structure demand, uncertainty separation, HCLPF checks, and full mean fragility curves over the hazard range of interest.";
  sfr.documentation.engineeringJudgments = "Judgments identify applicable equipment classes, scale sparse test evidence, assign dependence and correlation, and bound incomplete pre-operational details; each judgment is tied to sensitivity or closure evidence.";
  sfr.documentation.fragilityParameterResults = "Median, betaR, betaU, composite beta, HCLPF, and full mean curves are provided for modeled failure modes.";
  sfr.documentation.modelUncertaintiesAndAlternatives = "Demand, capacity, correlation, and secondary-hazard alternatives are evaluated in sensitivities.";
  sfr.documentation.preOperationalAndBoundingSiteLimitations = mef.metadata.limitations.join(" ");
  sfr.documentation.dataAndCalculationRefs = ["SFR-RESPONSE-RESULTS.H5", "QUALIFICATION-PRIMARY", "CAPACITY-SECONDARY"];
  sfr.documentation.traceability = [
    {
      sscRef: "SEL-PRIMARY",
      failureModeRef: "FAILURE-MODE-PRIMARY",
      mechanismRefs: ["MECHANISM-PRIMARY"],
      demandRefs: ["RESPONSE-PRIMARY-LOCATION"],
      fragilityRef: "FRAGILITY-PRIMARY",
      plantResponseModelRefs: ["INDUCED-FAILURE-1", "BE-SEL-PRIMARY"],
    },
    {
      sscRef: "SEL-SECONDARY",
      failureModeRef: "FAILURE-MODE-SECONDARY",
      mechanismRefs: ["MECHANISM-SECONDARY"],
      demandRefs: ["RESPONSE-PRIMARY-LOCATION", "SECONDARY-LIQUEFACTION"],
      fragilityRef: "FRAGILITY-SECONDARY",
      plantResponseModelRefs: ["INDUCED-FAILURE-2", "BE-SEL-SECONDARY"],
    },
  ];
  sfr.documentation.implementsSrs = srs("SFR-F1", "SFR-F2", "SFR-F3");

  const spr = mef.seismicPlantResponseAnalysis;
  spr.uuid = `SPR-${kind.toUpperCase()}`;
  spr.praScope = `Identify direct and secondary seismic initiators, adapt the internal-events model, quantify seismic event-sequence families, and identify ${reactor} risk insights.`;
  const equipment = populateSelAndResponse(mef, kind, building);
  populateThresholdsAndInvestigations(mef, kind, building);
  populateFragilityResults(mef, kind);
  populatePlantResponseModel(mef, kind);
  populateSeismicHumanReliability(mef, kind);
  populateQuantification(mef, kind);
  populateRiskInterpretation(mef, kind);
  spr.documentation.processDescription = "SHA inputs and SFR fragilities are integrated with seismic initiators, SEL development, adapted systems/event-sequence logic, HRA, and hazard-bin quantification.";
  spr.documentation.inputsDescription = "Controlled hazard intervals, spectra, fragility curves, SEL, internal-events models, success criteria, HRA, and retained secondary hazards.";
  spr.documentation.seismicEquipmentListDevelopment = "The SEL is reconciled to initiators, system logic, fragility scope, investigations, and retained secondary hazards.";
  spr.documentation.baseModelModifications = "Seismic initiators, conditional component failure, correlation, contact/interaction effects, mission times, and seismic-specific actions are added to the internal-events base.";
  spr.documentation.seismicHumanReliabilityInfluences = "Seismic cues, stress, workload, access, physical hazards, timing, training, and dependency are represented.";
  spr.documentation.preOperationalLimitations = mef.metadata.limitations.join(" ");
  spr.documentation.implementsSrs = srs("SPR-F1", "SPR-F2", "SPR-F3", "SPR-F4", "SPR-F5");

  mef.modelUncertainty = {
    uuid: `MODEL-UNCERTAINTY-SEISMIC-${kind.toUpperCase()}`,
    name: `${reactor} integrated Seismic PRA model uncertainty`,
    uncertaintySources: [
      {
        source: "Dependence among hazard, structural response, capacity, and fragility parameters",
        impact: "Can widen integrated frequency distributions and change the relative importance of common-cause SSC groups.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
      {
        source: "Pre-operational plant configuration and performance assumptions",
        impact: "Could change SEL scope, spatial interactions, operator access, and the leading systems contributors after as-built confirmation.",
        applicableElements: ["SFR", "SPR"],
      },
      {
        source: "Secondary-hazard source-to-plant coupling",
        impact: "Affects retained hazard occurrence, affected SSC scope, and conditional sequence response.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
    ],
    relatedAssumptions: [
      {
        assumption: `The ${site} profile set bounds the final safety-related footprint.`,
        basis: "Measured lower, best-estimate, and upper profiles are propagated and scheduled for construction confirmation.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
      {
        assumption: "Reference-design SSC locations, anchorage, and routing represent the intended plant configuration.",
        basis: "Controlled design records are used with explicit pre-operational closure actions.",
        applicableElements: ["SFR", "SPR"],
      },
    ],
    reasonableAlternatives: [
      {
        alternative: "Fully coupled Monte Carlo sampling across every hazard, response, fragility, systems, and HRA parameter",
        reasonNotSelected: "The reference calculation preserves material dependencies with stratified sampling and targeted coupling sensitivities at lower demonstration cost.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
      {
        alternative: "Treat every shared SSC and support as fully correlated",
        reasonNotSelected: "Mechanism-specific correlation groups better represent common demand, shared construction, and independent capacities; full correlation is retained as a sensitivity.",
        applicableElements: ["SFR", "SPR"],
      },
    ],
    requirementReference: "SHA-I1; SFR-F2; SPR-F3",
  };
  sha.modelUncertainty = {
    uuid: `MODEL-UNCERTAINTY-SHA-${kind.toUpperCase()}`,
    name: `${site} seismic hazard model uncertainty`,
    uncertaintySources: [
      {
        source: "Fault geometry, recurrence, event allocation, and maximum magnitude",
        impact: "Controls the local and regional source contribution across the risk-significant motion range.",
        applicableElements: ["SHA"],
      },
      {
        source: "Ground-motion median, sigma, regional path, and model dependence",
        impact: "Controls the slope and epistemic spread of the mean and fractile hazard curves.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
      {
        source: "Reference horizon and nonlinear local site response",
        impact: "Changes foundation input spectra and the motion transferred to response and fragility calculations.",
        applicableElements: ["SHA", "SFR"],
      },
    ],
    relatedAssumptions: [
      {
        assumption: "The selected magnitude, distance, frequency, amplitude, and epsilon limits capture all material hazard contribution.",
        basis: "Edge-bin and expanded-range sensitivities show negligible omitted contribution.",
        applicableElements: ["SHA"],
      },
    ],
    reasonableAlternatives: [
      {
        alternative: "Use the USGS 2023 NSHM without project-specific source, path, or site-response evaluation",
        reasonNotSelected: "The national model is a comparison and input source, but the identified-site nuclear application requires project-specific evaluation and uncertainty propagation.",
        applicableElements: ["SHA"],
      },
      {
        alternative: "Use a deterministic bounding spectrum",
        reasonNotSelected: "It would not provide annual-frequency curves, epistemic fractiles, deaggregation, or hazard intervals needed by Seismic PRA.",
        applicableElements: ["SHA", "SFR", "SPR"],
      },
    ],
    requirementReference: "SHA-C3; SHA-D3; SHA-E2; SHA-I1",
  };
  sfr.modelUncertainty = {
    uuid: `MODEL-UNCERTAINTY-SFR-${kind.toUpperCase()}`,
    name: `${reactor} seismic response and fragility model uncertainty`,
    uncertaintySources: [
      {
        source: "Structural stiffness, damping, SSI, and response-scaling representation",
        impact: "Changes in-structure median demand and its variability at SSC locations.",
        applicableElements: ["SFR", "SPR"],
      },
      {
        source: "Failure-mechanism selection, capacity scaling, and qualification-data applicability",
        impact: "Changes median capacity, HCLPF, fragility slope, and the controlling failure mode.",
        applicableElements: ["SFR", "SPR"],
      },
      {
        source: "Fragility correlation and shared support behavior",
        impact: "Can change multi-SSC failure probability and sequence-family frequency.",
        applicableElements: ["SFR", "SPR"],
      },
    ],
    relatedAssumptions: [
      {
        assumption: "Reference-design anchorage and support details are representative of the intended as-built configuration.",
        basis: "Design-document review supports the model and a physical walkdown remains a tracked closure item.",
        applicableElements: ["SFR", "SPR"],
      },
    ],
    reasonableAlternatives: [
      {
        alternative: "Equivalent-static demand for every SSC",
        reasonNotSelected: "Three-dimensional median-centered response and SSI are needed for structures and risk-significant distributed equipment; static checks remain limited to justified rugged items.",
        applicableElements: ["SFR"],
      },
      {
        alternative: "Independent fragility sampling for all SSCs",
        reasonNotSelected: "Common demand, construction, qualification, and support dependencies require mechanism-specific correlation groups.",
        applicableElements: ["SFR", "SPR"],
      },
    ],
    requirementReference: "SFR-B3; SFR-E3; SFR-F2",
  };
  spr.modelUncertainty = {
    uuid: `MODEL-UNCERTAINTY-SPR-${kind.toUpperCase()}`,
    name: `${reactor} seismic plant-response model uncertainty`,
    uncertaintySources: [
      {
        source: "Seismic initiator, induced-failure, and spatial-interaction logic",
        impact: "Changes accident-sequence paths and the importance of shared support and secondary effects.",
        applicableElements: ["SPR"],
      },
      {
        source: "Post-earthquake operator performance and dependency",
        impact: "Changes credited recovery and stabilization probabilities under degraded access, cues, and workload.",
        applicableElements: ["SPR"],
      },
      {
        source: "Hazard-bin discretization and rare-event approximation",
        impact: "Can bias integrated frequency if bins are too coarse or conditional sequence probability is not small.",
        applicableElements: ["SPR"],
      },
    ],
    relatedAssumptions: [
      {
        assumption: "Internal-events success criteria remain applicable after explicitly modeled seismic-induced failures and mission-time changes.",
        basis: "Systems review reconciles seismic initiators, unavailable equipment, interactions, operator actions, and retained hazards.",
        applicableElements: ["SPR"],
      },
    ],
    reasonableAlternatives: [
      {
        alternative: "Apply a single screening multiplier to the internal-events result",
        reasonNotSelected: "Explicit hazard-bin, fragility, correlation, sequence, and HRA integration is required to preserve physical contributors and risk insights.",
        applicableElements: ["SPR"],
      },
      {
        alternative: "Use point-estimate HEPs without seismic context or dependency",
        reasonNotSelected: "Post-earthquake timing, cues, stress, access, workload, and action dependence materially affect credited response.",
        applicableElements: ["SPR"],
      },
    ],
    requirementReference: "SPR-B1; SPR-D1; SPR-E5; SPR-F3",
  };

  mef.evidenceRegister.push(
    {
      uuid: "EVIDENCE-NON-LWR-STANDARD",
      name: "Non-LWR PRA standard seismic requirements",
      evidenceType: "DOCUMENT",
      sourceReference: "ASME/ANS RA-S-1.4-2021, Sections 4.3.10 through 4.3.12",
      revision: "2021",
      owner: "Standards basis",
      applicableSubelements: ["SHA", "SFR", "SPR"],
      applicability: "Defines the supporting requirements used to structure the hazard, fragility, plant-response, documentation, interface, and peer-review content.",
      qualityAndLimitations: "Normative requirements source; the example remains an illustrative implementation and does not claim formal conformance certification.",
      status: "CONTROLLED",
      implementsSrs: srs("SHA-I1", "SFR-F1", "SPR-F1"),
    },
    {
      uuid: "EVIDENCE-SSHAC-GUIDANCE",
      name: "NRC SSHAC implementation guidance",
      evidenceType: "DOCUMENT",
      sourceReference: "NUREG-2213, Updated Implementation Guidelines for SSHAC Hazard Studies",
      revision: "2018",
      owner: "Hazard team",
      applicableSubelements: ["SHA"],
      applicability: "Supports the Level 2 process roles, evaluation and integration activities, center-body-range demonstration, documentation, and independent review.",
      qualityAndLimitations: "Authoritative implementation guidance; project-specific procedural details remain illustrative.",
      status: "CONTROLLED",
      implementsSrs: srs("SHA-A2", "SHA-C1", "SHA-D1", "SHA-I1"),
    },
    {
      uuid: "EVIDENCE-USGS-2023-NSHM",
      name: "USGS 2023 National Seismic Hazard Model basis",
      evidenceType: "MODEL",
      sourceReference: "USGS 2023 50-State National Seismic Hazard Model and ground-motion characterization",
      revision: "2023",
      owner: "Hazard team",
      applicableSubelements: ["SHA"],
      applicability: "Provides a current public benchmark for western-US catalogs, source characterization, ground-motion models, site classes, spectra, curves, and deaggregation.",
      qualityAndLimitations: "National-scale public model; evaluated as an input and comparison rather than substituted for the identified-site nuclear hazard analysis.",
      status: "CONTROLLED",
      implementsSrs: srs("SHA-B2", "SHA-B4", "SHA-C4", "SHA-D2", "SHA-F1"),
    },
    {
      uuid: `EVIDENCE-REACTOR-BASIS-${kind.toUpperCase()}`,
      name: `${reactor} public technology basis`,
      evidenceType: "DOCUMENT",
      sourceReference: isSfr
        ? "NRC and DOE public sodium fast reactor design-criteria and passive-decay-heat-removal references"
        : "DOE and INL public modular HTGR, TRISO, helium-coolant, and passive-decay-heat-removal references",
      revision: "Public references reviewed through 2026",
      owner: "Systems and fragility team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: isSfr
        ? "Constrains pool-type sodium system functions, passive air heat removal, sodium interactions, and representative equipment failure effects."
        : "Constrains modular helium-cooled system functions, TRISO fuel retention, graphite heat capacity, reactor-cavity cooling, and representative equipment failure effects.",
      qualityAndLimitations: "Public technology characteristics anchor the fictional reference design; plant-specific equipment, dimensions, capacities, and risk values remain illustrative.",
      status: "CONTROLLED",
      implementsSrs: srs("SFR-A1", "SFR-D1", "SPR-B1", "SPR-B6"),
    },
    {
      uuid: "EVIDENCE-PEER-REVIEW-2026",
      name: `${reactor} illustrative Seismic PRA independent review record`,
      evidenceType: "REVIEW",
      sourceReference: "SEISMIC-PEER-REVIEW-2026",
      revision: "Draft 1",
      effectiveDate: "2026-06-10",
      owner: "Independent review team",
      applicableSubelements: ["SHA", "SFR", "SPR"],
      applicability: "Records multidisciplinary review coverage, demonstration findings, and pre-operational closure items.",
      qualityAndLimitations: "Illustrative review record for workflow demonstration; not an actual ASME/ANS peer review.",
      status: "DRAFT",
      implementsSrs: srs("SHA-I1", "SFR-F1", "SPR-F1"),
    },
  );

  mef.integration.interfaces = [
    { uuid: "IF-SHA-SFR", name: "Hazard-to-fragility interface", producer: "SHA", consumer: "SFR", payloadType: "RESPONSE_SPECTRUM", producerRefs: ["UHS-1E-4-H", "GMP-SA-1HZ", "CONTROL-POINT-FOUNDATION"], consumerRefs: ["REFERENCE-EQ-1", "STRUCTURAL-MODEL-1"], transferBasis: "Controlled spectra, motion definitions, control point, damping, and hazard range.", consistencyChecks: ["Parameter identifier resolves", "units and direction agree", "HROI lies within SHA range"], consistent: true, openItems: [], implementsSrs: srs("SHA-G1", "SFR-B1") },
    { uuid: "IF-SFR-SPR", name: "Fragility-to-plant-response interface", producer: "SFR", consumer: "SPR", payloadType: "FRAGILITY", producerRefs: [...sfr.results.fragilityEvaluations.map((evaluation) => evaluation.uuid), ...sfr.results.correlationGroups.map((group) => group.uuid)], consumerRefs: ["INDUCED-FAILURE-1", "INDUCED-FAILURE-2", ...spr.quantification.eventSequenceFamilyQuantifications.map((family) => family.uuid)], transferBasis: "SEL item and failure-mode identifiers link mean fragilities and correlation to systems basic events.", consistencyChecks: ["Every active SEL failure mode has one controlling fragility", "correlation groups resolve"], consistent: true, openItems: [], implementsSrs: srs("SFR-E1", "SPR-B3") },
    { uuid: "IF-SHA-SPR", name: "Hazard-to-plant-response interface", producer: "SHA", consumer: "SPR", payloadType: "HAZARD_INTERVAL", producerRefs: sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid), consumerRefs: spr.quantification.hazardDiscretizations.map((item) => item.uuid), transferBasis: "Non-overlapping interval frequencies and representative motion values are transferred from the mean hazard curve.", consistencyChecks: ["Frequencies reconcile", "range reaches fragility saturation", "bin refinement converges"], consistent: true, openItems: [], implementsSrs: srs("SHA-F3", "SPR-E1") },
  ];
  mef.integration.consistencyChecks = [
    { uuid: "CHECK-GMP", name: "Ground-motion parameter consistency", checkType: "GROUND_MOTION_PARAMETER", subelements: ["SHA", "SFR", "SPR"], comparedRefs: ["GMP-SA-1HZ", "REFERENCE-EQ-1", spr.quantification.hazardDiscretizations[0]?.uuid ?? "DISCRETIZATION-1"], method: "Compare identifier, definition, direction, units, frequency, damping, and use range.", result: "PASS", evidence: "All three subelements use geometric-mean horizontal SA at 1 Hz in g at the foundation control point.", openItems: [], implementsSrs: srs("SHA-A4", "SFR-B1", "SPR-E1") },
    { uuid: "CHECK-SEL", name: "Seismic equipment list coverage", checkType: "SEISMIC_EQUIPMENT_LIST", subelements: ["SFR", "SPR"], comparedRefs: ["SEL-2026", ...sfr.results.fragilityEvaluations.map((evaluation) => evaluation.uuid)], method: "Resolve every active equipment failure mode through fragility and plant-response basic event.", result: "PASS", evidence: "Two active example SEL items have controlling fragilities and induced-failure models; threshold confirmations and specialized source evaluations remain separately traceable.", openItems: [], implementsSrs: srs("SFR-A1", "SPR-B1") },
    { uuid: "CHECK-SECONDARY", name: "Secondary-hazard consistency", checkType: "SECONDARY_HAZARD", subelements: ["SHA", "SFR", "SPR"], comparedRefs: ["SECONDARY-LIQUEFACTION", "MECHANISM-SECONDARY", "INITIATOR-LIQUEFACTION", "SECONDARY-EXTERNAL-FLOODING", "INITIATOR-EXTERNAL-FLOOD", "ESF-QUANT-EXTERNAL-FLOOD"], method: "Trace each retained hazard through its affected SSCs, mechanisms or external-hazard interface, fragilities, initiating event, and sequence quantification.", result: "PASS", evidence: "Liquefaction and seismically induced upstream-reservoir flooding are retained and fully traced through the applicable SHA, external-flood, fragility, and plant-response records.", openItems: [], implementsSrs: srs("SHA-H4", "SHA-I2", "SFR-E5", "SPR-A4", "SPR-B11") },
  ];
  mef.integration.coverage = {
    sprEquipmentCount: equipment.length,
    fragilityScopeEquipmentCount: equipment.length,
    quantifiedFragilityCount: sfr.results.fragilityEvaluations.length,
    unlinkedEquipmentRefs: [],
    unmodeledFailureModeRefs: [],
    retainedSecondaryHazardRefs: [
      "SECONDARY-LIQUEFACTION",
      "SECONDARY-EXTERNAL-FLOODING",
    ],
    modeledSecondaryHazardRefs: [
      "SECONDARY-LIQUEFACTION",
      "SECONDARY-EXTERNAL-FLOODING",
    ],
    coverageBasis: "Automated identifier reconciliation plus joint SHA/SFR/SPR technical review.",
  };
  mef.integration.selectedGroundMotionParameterRefs = sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid);
  mef.integration.selectedControlPointRefs = ["CONTROL-POINT-FOUNDATION"];
  mef.integration.hazardCurveRefs = ["HAZARD-CURVE-MEAN-1HZ"];
  mef.integration.responseSpectrumRefs = ["UHS-1E-4-H"];
  mef.integration.hazardIntervalRefs = sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid);
  mef.integration.seismicEquipmentListRef = "SEL-2026";
  mef.integration.fragilityResultRefs =
    sfr.results.fragilityEvaluations.map((evaluation) => evaluation.uuid);
  mef.integration.eventSequenceFamilyQuantificationRefs =
    spr.quantification.eventSequenceFamilyQuantifications.map((family) => family.uuid);
  mef.integration.externalFloodingAnalysisRefs = [
    kind === "sfr"
      ? "PIONEER-MESA-XF-ANALYSIS-2026"
      : "CEDAR-BASIN-XF-ANALYSIS-2026",
  ];
  mef.integration.eventSequenceQuantificationRefs = ["ESQ-REFERENCE-MODEL"];
  mef.integration.riskIntegrationRefs = ["RI-SEISMIC-CONTRIBUTION"];
  mef.integration.integrationMethod = "Configuration-controlled identifiers, explicit producer/consumer records, automated coverage checks, and multidisciplinary review maintain SHA/SFR/SPR consistency.";
  mef.integration.unresolvedInterfaces = [];
  mef.integration.implementsSrs = srs("SHA-F3", "SFR-A1", "SPR-E1");
  mef.integratedUncertainties = [{
    uuid: "INT-UNCERTAINTY-1",
    name: "Ground motion, response, and capacity dependency",
    sourceSubelement: "SHA",
    sourceUncertaintyRef: "GM-LT-1",
    affectedSubelements: ["SHA", "SFR", "SPR"],
    affectedEventSequenceFamilyRefs:
      spr.quantification.eventSequenceFamilyQuantifications.map((family) => family.eventSequenceFamilyRef),
    uncertaintyType: "MODEL",
    dependencyAndCorrelationTreatment: "Common ground-motion branches are sampled consistently with response and fragility parameters; no double counting of ergodic site variability.",
    propagationOrSensitivityTreatment: "Propagated in the integrated uncertainty calculation and challenged with correlation sensitivities.",
    combinedEffect: "Sets the upper tail of seismic event-sequence-family frequency but does not change leading SSC ranking.",
    importance: ImportanceLevel.HIGH,
    sensitivityStudyRefs: ["SENS-FRAGILITY-BETA", "SENS-SPR-FRAGILITY-CORRELATION"],
    closureOrRefinementActions: ["Confirm final site profile and vendor capacity data"],
    implementsSrs: srs("SHA-F2", "SFR-E3", "SPR-E5"),
  }];
  mef.integratedSensitivityStudies = [...sfr.results.sensitivityStudies, ...spr.quantification.sensitivityStudies];
  mef.documentation.overallProcessDescription = "The Seismic PRA is one integrated technical element composed of SHA, SFR, and SPR, with controlled interfaces and shared identifiers from site characterization through risk insights.";
  mef.documentation.shaSummary = "Site-specific SSHAC Level 2 mean hazard, spectra, discretization, and retained secondary hazards.";
  mef.documentation.sfrSummary = "Median-centered response, investigations, explicit failure mechanisms, mean fragilities, uncertainty, and correlation.";
  mef.documentation.sprSummary = "Seismic initiators, reconciled SEL, adapted plant model and HRA, converged hazard-bin integration, and risk insights.";
  mef.documentation.subelementInterfaceDescription = "Three explicit producer-consumer records and three multidisciplinary consistency checks connect SHA, SFR, and SPR.";
  mef.documentation.integratedResultsSummary = spr.documentation.eventSequenceFamilyResults;
  mef.documentation.integratedRiskInsights = spr.documentation.riskSignificantContributors;
  mef.documentation.integratedUncertaintySummary = "Ground-motion median, site response, component capacity, and fragility correlation dominate integrated uncertainty.";
  mef.documentation.preOperationalAndBoundingSiteLimitations = "Complete final as-built configuration reconciliation, vendor record confirmation, and physical walkdown before operational use.";
  mef.documentation.configurationControlDescription = "Identifiers, input files, model revisions, calculations, evidence, and interface checks are maintained under the project configuration-control program.";
  mef.documentation.peerReviewBasis = {
    peerReviewIds: ["SEISMIC-PEER-REVIEW-2026"],
    systemsEngineeringCoverage: "Systems engineering and operations reviewers cover SEL completeness, failure effects, model logic, and risk insights.",
    seismicHazardCoverage: "Qualified hazard reviewers cover SSHAC process, source/ground-motion/site-response models, calculations, and secondary hazards.",
    seismicCapabilityCoverage: "Structural and equipment capability reviewers cover response, investigations, mechanisms, capacity, fragility, and correlation.",
    seismicPraCoverage: "Seismic PRA reviewers cover initiators, model adaptation, HRA, quantification, integration, and uncertainty.",
    fragilityWalkdownExperienceCoverage: "The team includes a seismic walkdown lead and equipment/civil capability specialists.",
    methodologyReviewScope: "The review addresses all 109 SHA, SFR, and SPR supporting requirements for CC-II pre-operational use.",
    openFindingRefs: ["PREOP-ASBUILT-WALKDOWN"],
  };
  mef.documentation.supportingDocumentRefs = ["SHA-REPORT-2026", "SFR-REPORT-2026", "SPR-REPORT-2026", "SEISMIC-INTEGRATION-REPORT-2026"];
  mef.documentation.traceabilityMatrix = [
    {
      requirement: "SHA-F3",
      subelement: "SHA",
      dataRefs: [`EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`],
      modelRefs: ["SOURCE-LT-1", "GM-LT-1", "SITE-RESPONSE-METHOD-1"],
      resultRefs: ["HAZARD-CURVE-MEAN-1HZ", "UHS-1E-4-H"],
      documentationRefs: ["EVIDENCE-SHA-REPORT", "SHA-REPORT-2026"],
    },
    {
      requirement: "SFR-E1",
      subelement: "SFR",
      dataRefs: ["SEL-2026", ...Array.from(new Set(sfr.results.fragilityEvaluations.flatMap((evaluation) => evaluation.capacityDataRefs)))],
      modelRefs: sfr.results.failureMechanisms.map((mechanism) => mechanism.uuid),
      resultRefs: sfr.results.fragilityEvaluations.map((evaluation) => evaluation.uuid),
      documentationRefs: ["EVIDENCE-SFR-CALCS", "SFR-REPORT-2026"],
    },
    {
      requirement: "SPR-E1",
      subelement: "SPR",
      dataRefs: ["SEL-2026", "HAZARD-CURVE-MEAN-1HZ"],
      modelRefs: ["SY-SEISMIC-MODEL", "DISCRETIZATION-1"],
      resultRefs: ["ESF-QUANT-1", "CONTRIBUTOR-SECONDARY-SSC"],
      documentationRefs: ["EVIDENCE-SEL", "SPR-REPORT-2026", "SEISMIC-INTEGRATION-REPORT-2026"],
    },
  ];
  mef.configurationControlRecordId = `CC-SEISMIC-${kind.toUpperCase()}-2026`;
  populateRiskIntegrationBaseline(mef, kind);
  mef.newlyDevelopedMethodIds = ["NM-SEISMIC-BIN-INTEGRATION"];
  mef.exampleDocuments = isSfr
    ? [
      { id: "DOC-SHA", name: `${reactor} seismic hazard report.pdf`, kind: "doc", sizeLabel: "8.4 MB", uploadedLabel: "Hazard team", extracted: "Site, source, ground-motion, response-spectrum, and secondary-hazard inputs", linked: 31 },
      { id: "DOC-SFR", name: `${reactor} seismic fragility calculations.xlsx`, kind: "sheet", sizeLabel: "4.7 MB", uploadedLabel: "Fragility team", extracted: "Response, capacity, beta, HCLPF, and fragility-curve records", linked: 18 },
      { id: "DOC-SEL", name: `${reactor} seismic equipment list.xlsx`, kind: "sheet", sizeLabel: "2.1 MB", uploadedLabel: "Systems team", extracted: "SSC scope, functions, failure modes, correlations, and dispositions", linked: 22 },
    ]
    : [
      { id: "DOC-HTGR-EVIDENCE-GUIDE", name: "MHTGR Evidence Starter Guide.pdf", kind: "doc", sizeLabel: "1.2 MB", uploadedLabel: "OpenPRA example workbook", extracted: "Plain-language guide with real controlled-document, calculation, data, model, and review pages", linked: 10, url: "/api/example-documents/seismic-pra/mhtgr-evidence-guide" },
      { id: "EVIDENCE-BASELINE-PRA-HTGR", name: "MHTGR PRA model basis report.pdf", kind: "doc", sizeLabel: "3.8 MB", uploadedLabel: "U.S. Department of Energy / GA Technologies", extracted: "PRA methodology, initiating events, event trees, quantification, and earthquake treatment", linked: 2, url: "/api/example-documents/seismic-pra/mhtgr-pra-model" },
      { id: "EVIDENCE-DESIGN-DRAWINGS-HTGR", name: "MHTGR Overall Plant Design Specification.pdf", kind: "doc", sizeLabel: "7.6 MB", uploadedLabel: "Modular HTGR Plant Design Control Office", extracted: "Controlled reference-plant functions, requirements, classifications, and interfaces", linked: 2, url: "/api/example-documents/seismic-pra/mhtgr-opds" },
      { id: "EVIDENCE-PPIS-SDD-HTGR", name: "MHTGR Protection and Instrumentation System Design Description.pdf", kind: "doc", sizeLabel: "4.4 MB", uploadedLabel: "GA Technologies", extracted: "Protection functions, classification, qualification requirements, and interfaces", linked: 2, url: "/api/example-documents/seismic-pra/mhtgr-ppis-sdd" },
      { id: "EVIDENCE-RCCS-SDD-HTGR", name: "MHTGR Reactor Cavity Cooling System Design Description.pdf", kind: "doc", sizeLabel: "4.8 MB", uploadedLabel: "GA Technologies", extracted: "Passive heat-removal system function, requirements, interfaces, and quality basis", linked: 2, url: "/api/example-documents/seismic-pra/mhtgr-rccs-sdd" },
      { id: "EVIDENCE-NRC-REVIEW-HTGR", name: "NUREG-1338 MHTGR Preapplication Safety Evaluation.pdf", kind: "doc", sizeLabel: "18.6 MB", uploadedLabel: "U.S. Nuclear Regulatory Commission", extracted: "Independent seismic-design review scope, criteria, conclusions, and unresolved items", linked: 2, url: "/api/example-documents/seismic-pra/mhtgr-nrc-review" },
      { id: "DOC-HTGR-CALCULATION-EXAMPLE", name: "MHTGR Multi-physics Analysis.pdf", kind: "doc", sizeLabel: "1.7 MB", uploadedLabel: "Public technical literature", extracted: "Illustrative calculation anatomy: model, mesh, convergence, uncertainty, and results", linked: 1, url: "/api/example-documents/seismic-pra/mhtgr-analysis" },
      { id: "DOC-HTGR-DATA-EXAMPLE", name: "HTTF Design and Scaling Report.pdf", kind: "doc", sizeLabel: "6.4 MB", uploadedLabel: "Oregon State University", extracted: "Test-facility revision control, instrumentation, acquisition channels, and uncertainty", linked: 1, url: "/api/example-documents/seismic-pra/mhtgr-httf-data" },
      { id: "DOC-HTGR-BENCHMARK-EXAMPLE", name: "MHTGR-350 Core Design Benchmark.pdf", kind: "doc", sizeLabel: "8.0 MB", uploadedLabel: "OECD Nuclear Energy Agency", extracted: "Benchmark specification for code-to-code comparison and model verification", linked: 1, url: "/api/example-documents/seismic-pra/mhtgr-benchmark-validation" },
      { id: "DOC-SHA", name: `${reactor} seismic hazard report.pdf`, kind: "doc", sizeLabel: "8.4 MB", uploadedLabel: "Hazard team", extracted: "Site, source, ground-motion, response-spectrum, and secondary-hazard inputs", linked: 31 },
      { id: "DOC-SFR", name: `${reactor} seismic fragility calculations.xlsx`, kind: "sheet", sizeLabel: "4.7 MB", uploadedLabel: "Fragility team", extracted: "Response, capacity, beta, HCLPF, and fragility-curve records", linked: 18 },
      { id: "DOC-SEL", name: `${reactor} seismic equipment list.xlsx`, kind: "sheet", sizeLabel: "2.1 MB", uploadedLabel: "Systems team", extracted: "SSC scope, functions, failure modes, correlations, and dispositions", linked: 22 },
    ];

  const conformancePaths: Record<string, Record<string, string>> = {
    SHA: {
      A: "seismicHazardAnalysis.analysisBasis",
      B: "seismicHazardAnalysis.earthScienceInputs",
      C: "seismicHazardAnalysis.sourceCharacterization",
      D: "seismicHazardAnalysis.groundMotionCharacterization",
      E: "seismicHazardAnalysis.siteResponseAnalysis",
      F: "seismicHazardAnalysis.hazardQuantification",
      G: "seismicHazardAnalysis.responseSpectraEvaluation",
      H: "seismicHazardAnalysis.secondaryHazardEvaluation",
      I: "seismicHazardAnalysis.documentation",
    },
    SFR: {
      A: "seismicFragilityAnalysis.scope",
      B: "seismicFragilityAnalysis.seismicResponseAnalysis",
      C: "seismicFragilityAnalysis.thresholdProgram",
      D: "seismicFragilityAnalysis.plantInvestigations",
      E: "seismicFragilityAnalysis.results",
      F: "seismicFragilityAnalysis.documentation",
    },
    SPR: {
      A: "seismicPlantResponseAnalysis.initiatingEventIdentification",
      B: "seismicPlantResponseAnalysis.plantResponseModel",
      C: "seismicPlantResponseAnalysis.seismicEquipmentListDevelopment",
      D: "seismicPlantResponseAnalysis.humanReliabilityModel",
      E: "seismicPlantResponseAnalysis.quantification",
      F: "seismicPlantResponseAnalysis.documentation",
    },
  };
  const conformanceEvidence: Record<string, string> = {
    SHA: "EVIDENCE-SHA-REPORT, EVIDENCE-SSHAC-GUIDANCE, and EVIDENCE-USGS-2023-NSHM",
    SFR: `EVIDENCE-SFR-CALCS, EVIDENCE-SEL, and EVIDENCE-REACTOR-BASIS-${kind.toUpperCase()}`,
    SPR: `EVIDENCE-SEL, EVIDENCE-REACTOR-BASIS-${kind.toUpperCase()}, and EVIDENCE-PEER-REVIEW-2026`,
  };
  const notApplicableSrs = new Set([
    "SHA-E2",
    "SHA-E4",
    "SHA-E6",
    "SHA-I3",
    "SFR-D3",
    "SPR-B9",
    "SPR-B10",
    ...(isSfr ? ["SPR-B13"] : []),
  ]);
  mef.conformanceMatrix = mef.conformanceMatrix.map((row) => {
    const [subelement = "SPR", requirement = "F"] = row.sr.split("-");
    const hlr = requirement.charAt(0);
    const path = conformancePaths[subelement]?.[hlr] ?? "documentation";
    const isNotApplicable = notApplicableSrs.has(row.sr);
    return {
      ...row,
      status: isNotApplicable ? "NOT_APPLICABLE" : "MET",
      satisfiedByElementPaths: [path],
      evidence: isNotApplicable
        ? `${row.sr} is not applicable to the ${reactor} identified-site, pre-operational configuration and retained-hazard scope.`
        : `${row.sr} is implemented at ${path} for the ${reactor} illustrative example and is supported by ${conformanceEvidence[subelement]}.`,
      reviewNotes: isNotApplicable
        ? "Applicability was evaluated against site basis, plant stage, reactor count, and retained secondary hazards."
        : "Example status demonstrates a complete seeded workflow; it is not a formal peer-review or licensing determination.",
    };
  });

  return mef;
}
