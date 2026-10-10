import type { EsqCell, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { BarrierStatus, SourceLocation, type PlantOperatingStatesAnalysis, type RadioactiveSource, type RadionuclideTransportBarrier } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { RadionuclideBarrierCriterion, SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { type EsqUpstream } from "../esqLinks";
import { liveEsqOf, withModelImported } from "../esqModel";
import { withBarrierEntry, withCell, withMechanism } from "../esqBarriers";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";

function source(id: string, name: string, barriers: string[]): RadioactiveSource {
  return { uuid: id, name, location: SourceLocation.IN_CORE, description: "", radionuclides: [], status: "", releasePaths: [], barriers, screeningStatus: ScreeningStatus.RETAINED };
}

function barrier(id: string, name: string, status: BarrierStatus, breach: string[] = []): RadionuclideTransportBarrier {
  return { uuid: id, name, status, monitoringParameters: ["Activity"], breachCriteria: breach };
}

const CRITERION: RadionuclideBarrierCriterion = {
  uuid: "BAR-FUEL",
  barrierId: "BAR-FUEL",
  protectionParameters: [{ parameter: "Peak fuel temperature", criterion: "Below the 1600 C limit", basis: "CALC-1" }],
  challengeLoads: [{ eventSequenceReference: "A-2", loadDescription: "Heat-up with cooling lost", physicalAttributes: ["Temperature", "Heat-up window"] }],
  capacityParameters: ["1600 C limit"],
  effectivenessEvaluationMethod: "REALISTIC",
  uncertaintyAssessment: "Window sampled across decay heat.",
  engineeringAnalysisReferences: ["CALC-1"],
  implementsSrs: [],
};

function barrierUpstream(): EsqUpstream {
  const upstream = modelUpstream();
  upstream.pos = {
    plantOperatingStates: [
      {
        uuid: "POS-01",
        name: "Full power",
        meanDurationHours: 7300,
        radioactiveMaterialSources: [source("S-1", "In-core fuel", ["Fuel coating", "Primary boundary"]), source("S-2", "Plateout", ["Primary boundary"])],
        radionuclideTransportBarriers: [barrier("B-1", "Fuel coating", BarrierStatus.INTACT, ["Activity above limit"]), barrier("B-2", "Primary boundary", BarrierStatus.INTACT), barrier("B-3", "Building", BarrierStatus.INTACT)],
      },
      {
        uuid: "POS-02",
        name: "Shutdown",
        meanDurationHours: 594,
        radioactiveMaterialSources: [source("S-3", "In-core fuel (decay)", ["Fuel coating", "Primary boundary"])],
        radionuclideTransportBarriers: [barrier("B-1", "Fuel coating", BarrierStatus.INTACT), barrier("B-2", "Primary boundary", BarrierStatus.OPEN), barrier("B-3", "Building", BarrierStatus.INTACT)],
      },
    ],
  } as PlantOperatingStatesAnalysis;
  const missionTimes: SuccessCriteriaDevelopment["missionTimes"] = [];
  upstream.sc = { radionuclideBarrierCriteria: [CRITERION], missionTimes } as SuccessCriteriaDevelopment;
  const ie = upstream.ie;
  if (ie === undefined) throw new Error("fixture has no IE");
  upstream.ie = {
    ...ie,
    initiatingEventGroups: ie.initiatingEventGroups.map((group) => ({ ...group, memberInitiatorIds: ["I-1", "I-2"] })),
    initiators: [
      { uuid: "I-1", name: "Loss of forced cooling", barrierImpacts: [{ barrierId: "RCB", state: "INTACT", timing: "At initiation", mechanism: "Loss of forced cooling" }] },
      { uuid: "I-2", name: "Small leak", groupId: "IEG-01", barrierImpacts: [{ barrierId: "RCB", state: "DEGRADED", timing: "At initiation", mechanism: "Small primary leak" }] },
    ],
  } as InitiatingEventsAnalysis;
  const sy = upstream.sy;
  if (sy === undefined) throw new Error("fixture has no SY");
  sy.environmentalDesignBasisConsiderations = [{ uuid: "SPC-1", systemReference: "SYS-COOL", components: ["DMP-A", "DMP-B"], eventSequences: [], environmentalConditions: "A blowdown heats the damper room.", initiatingEventIds: ["IEG-01"], beyondQualification: true, implementsSrs: [] }];
  sy.overCapacityConsiderations = [{ uuid: "OC-1", system: "SYS-COOL", potentialExceedanceScenarios: ["Decay heat above the rated duty"], treatment: "CONSERVATIVE", justificationForCapability: "Rated duty used.", implementsSrs: [] }];
  const hr = upstream.hr;
  if (hr === undefined) throw new Error("fixture has no HR");
  upstream.hr = {
    ...hr,
    humanFailureEvents: [
      ...hr.humanFailureEvents,
      { uuid: "HR-POST-1", name: "Fails to start the filtration train", hfeTiming: "POST_INITIATOR", responseDetail: { requiredResponse: "Start", responseType: "INITIATE", successCriteriaIds: [], procedureReferences: [], cueDescription: "High building activity" } },
    ],
    hepQuantifications: [
      ...hr.hepQuantifications,
      { uuid: "Q-2", hfeId: "HR-POST-1", methodology: "SPAR-H", assessmentType: "DETAILED_ASSESSMENT", isRiskSignificant: true, hep: { node: "VALUE" as const, value: { unit: "PROBABILITY" as const, law: { family: "POINT" as const, value: 1.5e-2 } } }, timeAvailableMinutes: 120, timeRequiredMinutes: 30, cueArrivalTimeMinutes: 15, implementsSrs: [] },
    ],
    recoveryActions: [{
      uuid: "REC-1",
      name: "Start the standby train locally",
      hfeId: "HR-POST-1",
      appliedAtLevel: "SEQUENCE",
      restoredFunction: "Filtration",
      feasibility: { procedureOrGuidanceAvailable: true, trainingIncluded: true, cuesAvailable: true, manpowerAvailable: true, timeAvailable: true, accessibilityConfirmed: false, equipmentAvailable: true },
      preOperationalFeasibilityJustification: "Access during the event is under review.",
      hepQuantificationId: "Q-3",
      implementsSrs: [],
    }],
  } as HumanReliabilityAnalysis;
  const da = upstream.da;
  if (da === undefined) throw new Error("fixture has no DA");
  da.parameters = [
    ...da.parameters,
    { uuid: "P-WIN", name: "Time to the fuel limit", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: { node: "VALUE", value: { unit: "QUANTITY", law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 } } } },
    { uuid: "P-MIX", name: "Scaled window", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: { node: "OPERATION", operation: "MULTIPLY", operands: [{ node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 2 } } }, { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-WIN" } }] } },
  ] as typeof da.parameters;
  return upstream;
}

function barrierStored(): EventSequenceQuantification {
  const esq = linkedEsq();
  return withModelImported({ ...esq, linkedWorkbooks: { ...esq.linkedWorkbooks, SC: "sc-1" } }, barrierUpstream(), NOW);
}

function barrierEsq(): EventSequenceQuantification {
  return liveEsqOf(barrierStored(), barrierUpstream().da);
}

function windowCell(id: string): EsqCell {
  return {
    id,
    barrierId: "Fuel coating",
    modeId: "FM-1",
    familyId: "F-REL",
    mechanismIds: ["PH-1"],
    variable: "Time to the fuel limit",
    unit: "h",
    basis: "REALISTIC",
    load: { source: "TYPED", variable: { law: { family: "POINT", value: 48 }, fields: [] }, basis: "The 48 h window that defines the release category." },
    capacity: { source: "TYPED", variable: { law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }, fields: [] }, basis: "Heat-up window from the success criteria runs." },
    aging: "Burnup and fluence at end of life are inside the window runs.",
    use: "SPLIT_FRACTION",
    assumption: { calculation: "Core heat-up calculation", closure: "Confirmed by the as-built thermal analysis." },
  };
}

function modeledEsq(): EventSequenceQuantification {
  let esq = barrierEsq();
  esq = withBarrierEntry(esq, "Fuel coating", {
    barrierId: "Fuel coating",
    criterionId: "BAR-FUEL",
    modes: [
      { id: "FM-1", name: "Coating failure in heat-up", kind: "GROSS", location: "Hottest core region" },
      { id: "FM-2", name: "Defective particles", kind: "LOCALIZED", location: "Whole core" },
    ],
  });
  esq = withMechanism(esq, "PH-1", { id: "PH-1", barrierId: "Fuel coating", modeIds: ["FM-1"], kind: "PHENOMENON", name: "Conduction heat-up", familyIds: ["F-REL"], basis: "Success criteria heat-up runs." });
  return withCell(esq, "BC-1", windowCell("BC-1"));
}

export { NOW, barrierEsq, barrierStored, barrierUpstream, modeledEsq, windowCell };
