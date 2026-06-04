import {
  type EventSequenceAnalysis,
  type EventSequence,
  type EventSequenceFamily,
  type EventSequenceScreeningRecord,
  type EventTree,
  type ReleaseCategoryMapping,
  type DependencyModels,
  type FunctionalDependencyModel,
  type PhenomenologicalDependencyModel,
  type OperationalDependencyModel,
  type HumanDependencyModel,
  type GroupingCriteria,
  EndState,
  DependencyType,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { FrequencyUnit, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SRConformance, type SRReference } from "interfaces-mef-types/core/pra-common";
import { type PlantRepresentationAccuracy } from "interfaces-mef-types/core/documentation";

function cm(srCode: string, hlr: SRConformance["hlr"], status: SRConformance["status"], stages: SRConformance["applicableToStage"], evidence: string): SRConformance {
  return { sr: srCode, hlr, capabilityCategory: "CC-II", applicableToStage: stages, status, satisfiedByElementPaths: [], evidence };
}

function sr(code: string, hlr: SRReference["hlr"]): SRReference {
  return { sr: code, hlr };
}

function freq(value: number): FrequencyWithDistribution {
  return { value, units: FrequencyUnit.PER_PLANT_YEAR };
}

const BOTH: SRConformance["applicableToStage"] = ["OPERATIONAL", "PRE_OPERATIONAL"];
const PRE: SRConformance["applicableToStage"] = ["PRE_OPERATIONAL"];
const NOW = "2026-04-30T12:00:00.000Z";

// ─── Helper: build an event tree from the reference's recursive structure ────
function buildTree(
  id: string,
  name: string,
  initiatingEventId: string,
  plantOperatingStateId: string,
  missionTimeHours: number,
  fes: { id: string; label: string; sub: string; sfId: string; scId: string }[],
  branchSpec: { id: string; feIndex: number; successTarget: string; failureTarget: string; successType: "BRANCH" | "SEQUENCE" | "END_STATE"; failureType: "BRANCH" | "SEQUENCE" | "END_STATE" }[],
  seqs: { id: string; endState: EndState; releaseCategoryId: string }[],
  initialBranchId: string,
): EventTree {
  const functionalEvents: EventTree["functionalEvents"] = {};
  for (const fe of fes) {
    functionalEvents[fe.id] = { uuid: `${id}-fe-${fe.id.toLowerCase()}`, name: fe.label, label: fe.id, order: fes.indexOf(fe) + 1, description: fe.sub, systemReference: fe.sfId, faultTreeId: fe.scId };
  }

  const branches: EventTree["branches"] = {};
  for (const b of branchSpec) {
    branches[b.id] = {
      uuid: `${id}-br-${b.id.toLowerCase()}`,
      name: b.id,
      functionalEventId: fes[b.feIndex].id,
      paths: [
        { state: "SUCCESS", target: b.successTarget, targetType: b.successType },
        { state: "FAILURE", target: b.failureTarget, targetType: b.failureType },
      ],
    };
  }

  const sequences: EventTree["sequences"] = {};
  for (const s of seqs) {
    sequences[s.id] = {
      uuid: `${id}-etseq-${s.id.toLowerCase()}`,
      name: s.id,
      endState: s.endState,
      eventSequenceId: s.id,
    };
  }

  return {
    uuid: id.toLowerCase(),
    name,
    initiatingEventId,
    plantOperatingStateId,
    functionalEvents,
    branches,
    sequences,
    initialState: { branchId: initialBranchId },
    missionTime: missionTimeHours,
    missionTimeUnits: "h",
    implementsSrs: [sr("ES-A6", "A"), sr("ES-A7", "A")],
  };
}

// ─── Event trees ─────────────────────────────────────────────────────────────

const ET_LOHS = buildTree(
  "ET-LOHS", "Loss of heat sink", "IEG-LOHS", "POS-01", 72,
  [
    { id: "RT",    label: "Reactor trip",             sub: "RPS / inherent",     sfId: "SF-RC",   scId: "SC-04" },
    { id: "SDHR",  label: "Shutdown heat removal",    sub: "Intermediate loop",  sfId: "SF-DHR",  scId: "SC-06" },
    { id: "DRACS", label: "Passive DHR",              sub: "≥1 of 3 DRACS",      sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF",  label: "Confinement",              sub: "Isolation + filter", sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT",    feIndex: 0, successTarget: "B-SDHR",  successType: "BRANCH",   failureTarget: "ESL-05", failureType: "SEQUENCE" },
    { id: "B-SDHR",  feIndex: 1, successTarget: "ESL-01",  successType: "SEQUENCE", failureTarget: "B-DRACS-L", failureType: "BRANCH" },
    { id: "B-DRACS-L", feIndex: 2, successTarget: "ESL-02", successType: "SEQUENCE", failureTarget: "B-CONF-L", failureType: "BRANCH" },
    { id: "B-CONF-L",  feIndex: 3, successTarget: "ESL-03", successType: "SEQUENCE", failureTarget: "ESL-04", failureType: "SEQUENCE" },
  ],
  [
    { id: "ESL-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESL-02", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESL-03", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "ESL-04", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
    { id: "ESL-05", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
  ],
  "B-RT",
);

const ET_RCB = buildTree(
  "ET-RCB", "Small primary sodium boundary leak", "IEG-RCB", "POS-01", 72,
  [
    { id: "RT",   label: "Reactor trip",   sub: "RPS",              sfId: "SF-RC",   scId: "SC-04" },
    { id: "ISOL", label: "Leak isolation", sub: "Detect + isolate", sfId: "SF-INV",  scId: "SC-09" },
    { id: "DRACS",label: "Passive DHR",    sub: "≥1 of 3 DRACS",    sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF", label: "Confinement",    sub: "Isolation + filter",sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT-R",     feIndex: 0, successTarget: "B-ISOL",   successType: "BRANCH",   failureTarget: "ESR-06", failureType: "SEQUENCE" },
    { id: "B-ISOL",     feIndex: 1, successTarget: "B-DRACS-R", successType: "BRANCH",   failureTarget: "B-CONF-R1", failureType: "BRANCH" },
    { id: "B-DRACS-R",  feIndex: 2, successTarget: "ESR-01",   successType: "SEQUENCE", failureTarget: "B-CONF-R2", failureType: "BRANCH" },
    { id: "B-CONF-R2",  feIndex: 3, successTarget: "ESR-02",   successType: "SEQUENCE", failureTarget: "ESR-03",  failureType: "SEQUENCE" },
    { id: "B-CONF-R1",  feIndex: 3, successTarget: "ESR-04",   successType: "SEQUENCE", failureTarget: "ESR-05",  failureType: "SEQUENCE" },
  ],
  [
    { id: "ESR-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESR-02", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-3" },
    { id: "ESR-03", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "ESR-04", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "ESR-05", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
    { id: "ESR-06", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
  ],
  "B-RT-R",
);

const ET_LOFA = buildTree(
  "ET-LOFA", "Loss of primary sodium flow (ULOF)", "IEG-LOFA", "POS-01", 72,
  [
    { id: "RT",   label: "Reactor trip",   sub: "RPS / inherent",    sfId: "SF-RC",   scId: "SC-04" },
    { id: "NC",   label: "Natural circ.",  sub: "Primary loop",      sfId: "SF-DHR",  scId: "SC-06" },
    { id: "DRACS",label: "Passive DHR",    sub: "≥1 of 3 DRACS",     sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF", label: "Confinement",    sub: "Isolation + filter", sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT-F",    feIndex: 0, successTarget: "B-NC",      successType: "BRANCH",   failureTarget: "B-DRACS-F0", failureType: "BRANCH" },
    { id: "B-NC",      feIndex: 1, successTarget: "ESF-01",    successType: "SEQUENCE", failureTarget: "B-DRACS-F1", failureType: "BRANCH" },
    { id: "B-DRACS-F1",feIndex: 2, successTarget: "ESF-02",    successType: "SEQUENCE", failureTarget: "B-CONF-F",   failureType: "BRANCH" },
    { id: "B-CONF-F",  feIndex: 3, successTarget: "ESF-03",    successType: "SEQUENCE", failureTarget: "ESF-04",     failureType: "SEQUENCE" },
    { id: "B-DRACS-F0",feIndex: 2, successTarget: "ESF-05",    successType: "SEQUENCE", failureTarget: "ESF-06",     failureType: "SEQUENCE" },
  ],
  [
    { id: "ESF-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESF-02", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESF-03", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "ESF-04", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
    { id: "ESF-05", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "ESF-06", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
  ],
  "B-RT-F",
);

const ET_TRANS = buildTree(
  "ET-TRANS", "General transient", "IEG-TRANS", "POS-01", 72,
  [
    { id: "RT",    label: "Reactor trip",          sub: "RPS / inherent",     sfId: "SF-RC",   scId: "SC-04" },
    { id: "SDHR",  label: "Shutdown heat removal", sub: "Intermediate loop",  sfId: "SF-DHR",  scId: "SC-06" },
    { id: "DRACS", label: "Passive DHR",           sub: "≥1 of 3 DRACS",      sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF",  label: "Confinement",           sub: "Isolation + filter", sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT-T",    feIndex: 0, successTarget: "B-SDHR-T",  successType: "BRANCH",   failureTarget: "EST-05",    failureType: "SEQUENCE" },
    { id: "B-SDHR-T",  feIndex: 1, successTarget: "EST-01",    successType: "SEQUENCE", failureTarget: "B-DRACS-T", failureType: "BRANCH" },
    { id: "B-DRACS-T", feIndex: 2, successTarget: "EST-02",    successType: "SEQUENCE", failureTarget: "B-CONF-T",  failureType: "BRANCH" },
    { id: "B-CONF-T",  feIndex: 3, successTarget: "EST-03",    successType: "SEQUENCE", failureTarget: "EST-04",    failureType: "SEQUENCE" },
  ],
  [
    { id: "EST-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "EST-02", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "EST-03", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2" },
    { id: "EST-04", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
    { id: "EST-05", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1" },
  ],
  "B-RT-T",
);

const ET_CGAS = buildTree(
  "ET-CGAS", "Cover-gas system breach", "IE-11", "POS-01", 48,
  [
    { id: "RT",   label: "Reactor trip",        sub: "RPS",                sfId: "SF-RC",   scId: "SC-04" },
    { id: "ISOL", label: "Cover-gas isolation", sub: "Isolate the path",   sfId: "SF-INV",  scId: "SC-09" },
    { id: "CONF", label: "Confinement",         sub: "Isolation + filter", sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT-G",   feIndex: 0, successTarget: "B-ISOL-G", successType: "BRANCH",   failureTarget: "ESG-04", failureType: "SEQUENCE" },
    { id: "B-ISOL-G", feIndex: 1, successTarget: "ESG-01",   successType: "SEQUENCE", failureTarget: "B-CONF-G", failureType: "BRANCH" },
    { id: "B-CONF-G", feIndex: 2, successTarget: "ESG-02",   successType: "SEQUENCE", failureTarget: "ESG-03",  failureType: "SEQUENCE" },
  ],
  [
    { id: "ESG-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESG-02", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-3" },
    { id: "ESG-03", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-2" },
    { id: "ESG-04", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
  ],
  "B-RT-G",
);

const ET_FIRE = buildTree(
  "ET-FIRE", "Internal sodium fire", "IE-15", "POS-01", 72,
  [
    { id: "RT",    label: "Reactor trip",     sub: "RPS",                sfId: "SF-RC",   scId: "SC-04" },
    { id: "SUPP",  label: "Fire suppression", sub: "Detect + suppress",  sfId: "SF-CONF", scId: "SC-12" },
    { id: "DRACS", label: "Passive DHR",      sub: "≥1 of 3 DRACS",      sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF",  label: "Confinement",      sub: "Isolation + filter", sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-RT-I",    feIndex: 0, successTarget: "B-SUPP",   successType: "BRANCH",   failureTarget: "ESI-05",    failureType: "SEQUENCE" },
    { id: "B-SUPP",    feIndex: 1, successTarget: "ESI-01",   successType: "SEQUENCE", failureTarget: "B-DRACS-I", failureType: "BRANCH" },
    { id: "B-DRACS-I", feIndex: 2, successTarget: "ESI-02",   successType: "SEQUENCE", failureTarget: "B-CONF-I",  failureType: "BRANCH" },
    { id: "B-CONF-I",  feIndex: 3, successTarget: "ESI-03",   successType: "SEQUENCE", failureTarget: "ESI-04",    failureType: "SEQUENCE" },
  ],
  [
    { id: "ESI-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESI-02", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESI-03", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-2" },
    { id: "ESI-04", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
    { id: "ESI-05", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
  ],
  "B-RT-I",
);

const ET_SEIS = buildTree(
  "ET-SEIS", "Seismic event", "IE-17", "POS-01", 72,
  [
    { id: "STRUCT", label: "Boundary intact", sub: "Survives ground motion", sfId: "SF-INV",  scId: "SC-09" },
    { id: "RT",     label: "Reactor trip",    sub: "Seismic trip",           sfId: "SF-RC",   scId: "SC-04" },
    { id: "DRACS",  label: "Passive DHR",     sub: "≥1 of 3 DRACS",          sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF",   label: "Confinement",     sub: "Isolation + filter",     sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-STRUCT",    feIndex: 0, successTarget: "B-RT-S",     successType: "BRANCH",   failureTarget: "ESS-05",    failureType: "SEQUENCE" },
    { id: "B-RT-S",      feIndex: 1, successTarget: "B-DRACS-S",  successType: "BRANCH",   failureTarget: "ESS-04",    failureType: "SEQUENCE" },
    { id: "B-DRACS-S",   feIndex: 2, successTarget: "ESS-01",     successType: "SEQUENCE", failureTarget: "B-CONF-S",  failureType: "BRANCH" },
    { id: "B-CONF-S",    feIndex: 3, successTarget: "ESS-02",     successType: "SEQUENCE", failureTarget: "ESS-03",    failureType: "SEQUENCE" },
  ],
  [
    { id: "ESS-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESS-02", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-2" },
    { id: "ESS-03", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
    { id: "ESS-04", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
    { id: "ESS-05", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
  ],
  "B-STRUCT",
);

const ET_DRAIN = buildTree(
  "ET-DRAIN", "Erroneous RCS drain-down", "IE-18", "POS-04", 48,
  [
    { id: "DETECT", label: "Detect & stop",  sub: "Level alarm + action", sfId: "SF-INV",  scId: "SC-09" },
    { id: "MAKEUP", label: "Restore level",  sub: "Make-up to core",      sfId: "SF-INV",  scId: "SC-09" },
    { id: "DRACS",  label: "Passive DHR",    sub: "≥1 of 3 DRACS",        sfId: "SF-DHR",  scId: "SC-06" },
    { id: "CONF",   label: "Confinement",    sub: "Isolation + filter",   sfId: "SF-CONF", scId: "SC-12" },
  ],
  [
    { id: "B-DETECT",    feIndex: 0, successTarget: "B-MAKEUP",   successType: "BRANCH",   failureTarget: "ESD-05",    failureType: "SEQUENCE" },
    { id: "B-MAKEUP",    feIndex: 1, successTarget: "B-DRACS-D",  successType: "BRANCH",   failureTarget: "ESD-04",    failureType: "SEQUENCE" },
    { id: "B-DRACS-D",   feIndex: 2, successTarget: "ESD-01",     successType: "SEQUENCE", failureTarget: "B-CONF-D",  failureType: "BRANCH" },
    { id: "B-CONF-D",    feIndex: 3, successTarget: "ESD-02",     successType: "SEQUENCE", failureTarget: "ESD-03",    failureType: "SEQUENCE" },
  ],
  [
    { id: "ESD-01", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS" },
    { id: "ESD-02", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-2" },
    { id: "ESD-03", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
    { id: "ESD-04", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-2" },
    { id: "ESD-05", endState: EndState.RADIONUCLIDE_RELEASE,  releaseCategoryId: "RC-1" },
  ],
  "B-DETECT",
);

const EVENT_TREES: EventTree[] = [ET_LOHS, ET_RCB, ET_LOFA, ET_TRANS, ET_CGAS, ET_FIRE, ET_SEIS, ET_DRAIN];

// ─── Flat event sequences ─────────────────────────────────────────────────────
const EVENT_SEQUENCES: EventSequence[] = [
  // ET-LOHS
  { uuid: "ESL-01", name: "ESL-01", initiatingEventId: "IEG-LOHS", plantOperatingStateId: "POS-01", eventTreeId: "et-lohs", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(4.6e-2), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESL-02", name: "ESL-02", initiatingEventId: "IEG-LOHS", plantOperatingStateId: "POS-01", eventTreeId: "et-lohs", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(9.1e-4), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESL-03", name: "ESL-03", initiatingEventId: "IEG-LOHS", plantOperatingStateId: "POS-01", eventTreeId: "et-lohs", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(2.3e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESL-04", name: "ESL-04", initiatingEventId: "IEG-LOHS", plantOperatingStateId: "POS-01", eventTreeId: "et-lohs", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(1.1e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESL-05", name: "ESL-05", initiatingEventId: "IEG-LOHS", plantOperatingStateId: "POS-01", eventTreeId: "et-lohs", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(4.7e-6), implementsSrs: [sr("ES-A7", "A")] },
  // ET-RCB
  { uuid: "ESR-01", name: "ESR-01", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(2.2e-3), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESR-02", name: "ESR-02", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-3", meanFrequency: freq(4.4e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESR-03", name: "ESR-03", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(2.2e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESR-04", name: "ESR-04", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(8.8e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESR-05", name: "ESR-05", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(4.4e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESR-06", name: "ESR-06", initiatingEventId: "IEG-RCB", plantOperatingStateId: "POS-01", eventTreeId: "et-rcb", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(2.3e-6), implementsSrs: [sr("ES-A7", "A")] },
  // ET-LOFA
  { uuid: "ESF-01", name: "ESF-01", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(5.3e-2), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESF-02", name: "ESF-02", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(1.1e-3), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESF-03", name: "ESF-03", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(2.6e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESF-04", name: "ESF-04", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(1.3e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESF-05", name: "ESF-05", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(5.4e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESF-06", name: "ESF-06", initiatingEventId: "IEG-LOFA", plantOperatingStateId: "POS-01", eventTreeId: "et-lofa", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(2.7e-7), implementsSrs: [sr("ES-A7", "A")] },
  // ET-TRANS
  { uuid: "EST-01", name: "EST-01", initiatingEventId: "IEG-TRANS", plantOperatingStateId: "POS-01", eventTreeId: "et-trans", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(2.55e0), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "EST-02", name: "EST-02", initiatingEventId: "IEG-TRANS", plantOperatingStateId: "POS-01", eventTreeId: "et-trans", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(4.8e-2), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "EST-03", name: "EST-03", initiatingEventId: "IEG-TRANS", plantOperatingStateId: "POS-01", eventTreeId: "et-trans", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(1.2e-5), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "EST-04", name: "EST-04", initiatingEventId: "IEG-TRANS", plantOperatingStateId: "POS-01", eventTreeId: "et-trans", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(6.0e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "EST-05", name: "EST-05", initiatingEventId: "IEG-TRANS", plantOperatingStateId: "POS-01", eventTreeId: "et-trans", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(5.2e-6), implementsSrs: [sr("ES-A7", "A")] },
  // ET-CGAS
  { uuid: "ESG-01", name: "ESG-01", initiatingEventId: "IE-11", plantOperatingStateId: "POS-01", eventTreeId: "et-cgas", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(2.1e-4), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESG-02", name: "ESG-02", initiatingEventId: "IE-11", plantOperatingStateId: "POS-01", eventTreeId: "et-cgas", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-3", meanFrequency: freq(8.0e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESG-03", name: "ESG-03", initiatingEventId: "IE-11", plantOperatingStateId: "POS-01", eventTreeId: "et-cgas", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(4.0e-8), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESG-04", name: "ESG-04", initiatingEventId: "IE-11", plantOperatingStateId: "POS-01", eventTreeId: "et-cgas", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(2.2e-7), implementsSrs: [sr("ES-A7", "A")] },
  // ET-FIRE
  { uuid: "ESI-01", name: "ESI-01", initiatingEventId: "IE-15", plantOperatingStateId: "POS-01", eventTreeId: "et-fire", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(4.7e-3), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESI-02", name: "ESI-02", initiatingEventId: "IE-15", plantOperatingStateId: "POS-01", eventTreeId: "et-fire", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(2.5e-4), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESI-03", name: "ESI-03", initiatingEventId: "IE-15", plantOperatingStateId: "POS-01", eventTreeId: "et-fire", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(6.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESI-04", name: "ESI-04", initiatingEventId: "IE-15", plantOperatingStateId: "POS-01", eventTreeId: "et-fire", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(3.0e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESI-05", name: "ESI-05", initiatingEventId: "IE-15", plantOperatingStateId: "POS-01", eventTreeId: "et-fire", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(5.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  // ET-SEIS
  { uuid: "ESS-01", name: "ESS-01", initiatingEventId: "IE-17", plantOperatingStateId: "POS-01", eventTreeId: "et-seis", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(9.0e-5), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESS-02", name: "ESS-02", initiatingEventId: "IE-17", plantOperatingStateId: "POS-01", eventTreeId: "et-seis", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(3.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESS-03", name: "ESS-03", initiatingEventId: "IE-17", plantOperatingStateId: "POS-01", eventTreeId: "et-seis", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(2.0e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESS-04", name: "ESS-04", initiatingEventId: "IE-17", plantOperatingStateId: "POS-01", eventTreeId: "et-seis", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(4.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESS-05", name: "ESS-05", initiatingEventId: "IE-17", plantOperatingStateId: "POS-01", eventTreeId: "et-seis", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(1.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  // ET-DRAIN
  { uuid: "ESD-01", name: "ESD-01", initiatingEventId: "IE-18", plantOperatingStateId: "POS-04", eventTreeId: "et-drain", endState: EndState.SUCCESSFUL_MITIGATION, releaseCategoryId: "SSS", meanFrequency: freq(3.9e-3), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESD-02", name: "ESD-02", initiatingEventId: "IE-18", plantOperatingStateId: "POS-04", eventTreeId: "et-drain", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(7.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESD-03", name: "ESD-03", initiatingEventId: "IE-18", plantOperatingStateId: "POS-04", eventTreeId: "et-drain", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(3.5e-7), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESD-04", name: "ESD-04", initiatingEventId: "IE-18", plantOperatingStateId: "POS-04", eventTreeId: "et-drain", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-2", meanFrequency: freq(9.0e-6), implementsSrs: [sr("ES-A7", "A")] },
  { uuid: "ESD-05", name: "ESD-05", initiatingEventId: "IE-18", plantOperatingStateId: "POS-04", eventTreeId: "et-drain", endState: EndState.RADIONUCLIDE_RELEASE, releaseCategoryId: "RC-1", meanFrequency: freq(2.0e-6), implementsSrs: [sr("ES-A7", "A")] },
];

// ─── Grouping criteria ────────────────────────────────────────────────────────
const GROUPING_CRITERIA: GroupingCriteria[] = [
  {
    uuid: "GC-1",
    name: "Release-category + plant-response grouping",
    description: "Sequences sharing an end state, release category, and similar plant response are grouped into families, each mapping to one source-term calculation.",
    basis: "ES-C8, consistent with HLR-MS-A.",
    characteristicsConsidered: ["End state", "Release category", "Worst-case plant response", "Confinement status", "Timing band"],
  },
];

// ─── Sequence families ────────────────────────────────────────────────────────
const SEQUENCE_FAMILIES: EventSequenceFamily[] = [
  {
    uuid: "ESF-OK",
    name: "Protected, safe stable state",
    groupingCriteriaId: "GC-1",
    representativeInitiatingEventId: "IEG-LOHS",
    representativePlantOperatingStateId: "POS-01",
    representativePlantResponse: "Reactor shut down; decay heat removed by a normal or passive path; no release.",
    memberSequenceIds: ["ESL-01","ESL-02","ESR-01","ESF-01","ESF-02","EST-01","EST-02","ESG-01","ESI-01","ESI-02","ESS-01","ESD-01"],
    endState: EndState.SUCCESSFUL_MITIGATION,
    meanFrequency: freq(3.6e0),
    implementsSrs: [sr("ES-C8", "C")],
  },
  {
    uuid: "ESF-LEAK",
    name: "Cooling lost, intact-confinement leakage",
    groupingCriteriaId: "GC-1",
    representativeInitiatingEventId: "IEG-RCB",
    representativePlantOperatingStateId: "POS-01",
    representativePlantResponse: "Decay heat lost; all outer barriers hold; design-leakage release only.",
    memberSequenceIds: ["ESR-02","ESG-02"],
    endState: EndState.RADIONUCLIDE_RELEASE,
    meanFrequency: freq(5.2e-6),
    implementsSrs: [sr("ES-C8", "C")],
  },
  {
    uuid: "ESF-LATE",
    name: "DHR failure, late filtered release",
    groupingCriteriaId: "GC-1",
    representativeInitiatingEventId: "IEG-RCB",
    representativePlantOperatingStateId: "POS-01",
    representativePlantResponse: "DHR fails; confinement holds; delayed filtered release via RC-2.",
    memberSequenceIds: ["ESL-03","ESR-03","ESR-04","ESF-03","ESF-05","EST-03","ESI-03","ESS-02","ESD-02","ESD-04","ESG-03"],
    endState: EndState.RADIONUCLIDE_RELEASE,
    meanFrequency: freq(5.1e-5),
    implementsSrs: [sr("ES-C8", "C")],
  },
  {
    uuid: "ESF-EARLY",
    name: "Confinement failure, early release",
    groupingCriteriaId: "GC-1",
    representativeInitiatingEventId: "IEG-RCB",
    representativePlantOperatingStateId: "POS-01",
    representativePlantResponse: "DHR and confinement both fail; earliest and largest release via RC-1.",
    memberSequenceIds: ["ESL-04","ESR-05","ESF-04","EST-04","ESG-04","ESI-04","ESS-03","ESS-05","ESD-03","ESD-05"],
    endState: EndState.RADIONUCLIDE_RELEASE,
    meanFrequency: freq(5.4e-6),
    implementsSrs: [sr("ES-C8", "C")],
  },
  {
    uuid: "ESF-ATWS",
    name: "Unprotected (ATWS) transients",
    groupingCriteriaId: "GC-1",
    representativeInitiatingEventId: "IEG-LOHS",
    representativePlantOperatingStateId: "POS-01",
    representativePlantResponse: "Reactor fails to trip; inherent reactivity feedback credited via intermediate end-state transfer to ATWS tree.",
    memberSequenceIds: ["ESL-05","ESR-06","ESF-06","EST-05","ESI-05","ESS-04"],
    endState: EndState.RADIONUCLIDE_RELEASE,
    meanFrequency: freq(2.7e-5),
    implementsSrs: [sr("ES-C8", "C")],
  },
];

// ─── Release category mappings ────────────────────────────────────────────────
const RELEASE_CATEGORY_MAPPINGS: ReleaseCategoryMapping[] = [
  {
    uuid: "RCM-SSS",
    eventSequenceIds: ["ESL-01","ESL-02","ESR-01","ESF-01","ESF-02","EST-01","EST-02","ESG-01","ESI-01","ESI-02","ESS-01","ESD-01"],
    releaseCategoryId: "SSS",
    mappingBasis: "All sequences that succeed in preventing any radionuclide release above the RI-A5 screening threshold are mapped to the safe stable state.",
    commonCharacteristics: ["All safety functions fulfilled", "No barrier breach below the screening level"],
    physicalReleaseCharacteristics: ["No release"],
    implementsSrs: [sr("ES-C1", "C"), sr("ES-C2", "C")],
  },
  {
    uuid: "RCM-RC3",
    eventSequenceIds: ["ESR-02","ESG-02"],
    releaseCategoryId: "RC-3",
    mappingBasis: "Sequences with an intact confinement experiencing only design-basis leakage, with full filtration credited.",
    commonCharacteristics: ["Confinement intact", "Cover-gas clean-up and filtration credited", "Decay heat lost to DRACS or similar passive path"],
    physicalReleaseCharacteristics: ["Very late release (> 72 h)", "Design-leakage rate", "Full plate-out and filtration credit"],
    implementsSrs: [sr("ES-C1", "C"), sr("ES-C2", "C")],
  },
  {
    uuid: "RCM-RC2",
    eventSequenceIds: ["ESL-03","ESR-03","ESR-04","ESF-03","ESF-05","EST-03","ESI-03","ESS-02","ESD-02","ESD-04","ESG-03"],
    releaseCategoryId: "RC-2",
    mappingBasis: "Sequences where DHR fails but confinement holds, giving a delayed and filtered release.",
    commonCharacteristics: ["Confinement intact at release", "DHR unavailable", "Aerosol settling credit over extended delay"],
    physicalReleaseCharacteristics: ["Late release (> 24 h)", "Moderate magnitude", "Filtration and settling credited"],
    implementsSrs: [sr("ES-C1", "C"), sr("ES-C2", "C")],
  },
  {
    uuid: "RCM-RC1",
    eventSequenceIds: ["ESL-04","ESR-05","ESF-04","EST-04","ESG-04","ESI-04","ESS-03","ESS-05","ESD-03","ESD-05","ESL-05","ESR-06","ESF-06","EST-05","ESI-05","ESS-04"],
    releaseCategoryId: "RC-1",
    mappingBasis: "Sequences where confinement fails or is bypassed, giving the earliest and largest release.",
    commonCharacteristics: ["Confinement failed or bypassed at release", "No filtration credit", "Driven by combined DHR + confinement failure or ATWS energy"],
    physicalReleaseCharacteristics: ["Early release (< 8 h)", "Large magnitude", "No filtration credit"],
    implementsSrs: [sr("ES-C1", "C"), sr("ES-C2", "C")],
  },
];

// ─── Dependency models ────────────────────────────────────────────────────────
const FUNCTIONAL_DEPS: FunctionalDependencyModel[] = [
  {
    uuid: "DEP-1",
    name: "DRACS dampers — Class-1E DC power",
    description: "All three DRACS air dampers fail open on loss of DC power, but their position read-out and auto-start signal share the same DC bus that also feeds the RPS logic.",
    involvedSystems: ["DRACS", "Class-1E-DC", "RPS"],
    dependencies: [
      {
        uuid: "DEP-1-D1",
        dependentElement: "DRACS",
        dependedUponElement: "Class-1E-DC",
        dependencyType: DependencyType.FUNCTIONAL,
        description: "DRACS damper position readout and auto-start signal depend on Class-1E DC power.",
        implementsSrs: [sr("ES-B2", "B")],
      },
    ],
    implementsSrs: [sr("ES-B2", "B"), sr("ES-B5", "B")],
  },
];

const PHENOM_DEPS: PhenomenologicalDependencyModel[] = [
  {
    uuid: "DEP-4",
    name: "Sodium pool fire phenomenological impact",
    description: "A sodium leak that catches fire fills the primary cell with thick smoke and heat, damaging cable trays shared by DRACS start-up and the RPS.",
    phenomenon: "Sodium pool fire",
    affectedSystems: ["DRACS", "RPS"],
    environmentalConditions: ["Elevated temperature", "Aerosol", "Smoke obscuration"],
    deterministicAnalysisReferences: ["F-PRA element"],
    implementsSrs: [sr("ES-B3", "B")],
  },
];

const OPER_DEPS: OperationalDependencyModel[] = [
  {
    uuid: "DEP-5",
    name: "Intermediate-loop pump maintenance window",
    description: "Both intermediate-loop pumps are serviced in the same outage, so the chance of both being out for maintenance is handled as a state-dependent split fraction in POS-04.",
    operationalPractice: "Simultaneous maintenance of intermediate-loop pumps",
    affectedSystems: ["Intermediate-loop-pump-A", "Intermediate-loop-pump-B"],
    procedureReferences: ["OP-211"],
    implementsSrs: [sr("ES-B7", "B")],
  },
];

const HUMAN_DEPS: HumanDependencyModel[] = [
  {
    uuid: "DEP-3",
    name: "HFE-12 conditioned on HFE-08 (backup DHR alignment)",
    description: "The operator can only line up the backup decay-heat path if the earlier diagnosis worked, so the two linked actions share one joint human-error probability.",
    involvedHumanActions: ["HFE-08", "HFE-12"],
    dependencyType: "Post-initiator HEP dependency (diagnosis gates alignment)",
    implementsSrs: [sr("ES-B2", "B"), sr("ES-B8", "B")],
  },
];

const DEPENDENCY_MODELS: DependencyModels = {
  functionalDependencies: FUNCTIONAL_DEPS,
  phenomenologicalDependencies: PHENOM_DEPS,
  operationalDependencies: OPER_DEPS,
  humanDependencies: HUMAN_DEPS,
  systemInterfaces: [
    {
      uuid: "DEP-6",
      name: "Guard vessel — reactor vessel support",
      description: "The guard vessel and reactor vessel share the same support skirt, so one earthquake failure can take out both.",
      involvedSystems: ["Guard-vessel", "Reactor-vessel"],
      interfaceType: "PHYSICAL",
      connectionPoints: ["Support skirt"],
      modelingApproach: "Not credited as separate barriers for earthquake events; treated as one boundary in the seismic tree.",
      implementsSrs: [sr("ES-B5", "B")],
    },
    {
      uuid: "DEP-2",
      name: "DRACS A/B/C common-cause failure",
      description: "The three DRACS loops are identical passive sodium-to-air heat exchangers; one shared cause can fail all three.",
      involvedSystems: ["DRACS-A", "DRACS-B", "DRACS-C"],
      interfaceType: "FUNCTIONAL",
      connectionPoints: ["Shared air-side pathway"],
      modelingApproach: "Beta-factor common-cause group on all three DRACS trains.",
      implementsSrs: [sr("ES-B2", "B")],
    },
  ],
};

// ─── Screening records ────────────────────────────────────────────────────────
const SCREENING_RECORDS: EventSequenceScreeningRecord[] = [
  { sequenceId: "ESR-02", retained: true, justification: "Retained: leads to its own release category (RC-3); no SCR-3 basis available.", implementsSrs: [sr("ES-A7", "A")] },
  { sequenceId: "ESL-04", retained: true, justification: "Retained for full analysis: reaches a release category, and barrier is challenged.", implementsSrs: [sr("ES-A7", "A")] },
  { sequenceId: "ESX-07", retained: false, criterion: "SCR-3", justification: "Slow-developing, alarmed, and fixed by procedure before any barrier is challenged.", implementsSrs: [sr("ES-A7", "A")] },
  { sequenceId: "ESX-11", retained: false, criterion: "SCR-3", justification: "Covered by the protected-transient family ESF-OK; no separate sequence.", implementsSrs: [sr("ES-A7", "A")] },
];

// ─── Plant representation accuracy ───────────────────────────────────────────
const PLANT_REPRESENTATION_ACCURACY: PlantRepresentationAccuracy = {
  scope: "PRE_OPERATIONAL",
  accuracy: ImportanceLevel.MEDIUM,
  basis: "Analysis uses realistic design-specific T/H calculations (RELAP/SAS) and SC workbook v2. SC v3 re-sync pending.",
  detailConsistentWithPlant: true,
  sufficientForRiskSignificantContributors: true,
  sufficiencyJustification: "All eight event trees are bounded by design-basis analyses. ATWS quantification deferred to ESQ.",
  highConfidenceAreas: ["Reactor trip timing", "DRACS natural-circulation performance", "Confinement isolation criteria"],
  lowerConfidenceAreas: ["ATWS inherent-reactivity feedback credit", "Sodium-fire impact on cable trays (DEP-4)", "SC v3 DRACS mission time"],
  improvementPlans: ["Re-sync SC v3 and update HFE-12 time window.", "Close DEP-4 cable-tray temperature qualification.", "Quantify ATWS tree in ESQ."],
  implementsSrs: [sr("ES-A11", "A")],
};

// ─── Full ES analysis ─────────────────────────────────────────────────────────
export const ES_ANALYSIS: EventSequenceAnalysis = {
  uuid: "es-generic-1",
  name: "ES Workbook Example",
  type: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS,
  version: "2",
  created: "2026-04-25T12:00:00.000Z",
  modified: NOW,
  owner: "dcaldwell",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: "2026-04-25T12:00:00.000Z", actor: "dcaldwell" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["dcaldwell"],
    reviewers: [
      { id: "nhartwell", name: "Dr. Nadia Hartwell",  role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer",      organization: "Generic Nuclear LLC" },
      { id: "mbeland",   name: "Marc Béland",          role: "INTERNAL_REVIEWER", title: "Independent Reviewer · Systems", organization: "Generic Nuclear LLC" },
      { id: "psubram",   name: "Priya Subramanian",    role: "INTERNAL_REVIEWER", title: "Independent Reviewer · Phenomena", organization: "Generic Nuclear LLC" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore",  role: "INTERNAL_APPROVER",  title: "PRA Technical Authority",    organization: "Generic Nuclear LLC" },
    ],
    scope: "Internal events, all operating states, Generic-1 sodium-cooled fast reactor (pre-operational).",
    limitations: ["ATWS tree not yet quantified; ESF-ATWS frequency is preliminary.", "SC v3 re-sync pending — HFE-12 time window may change."],
    lastModifiedDate: NOW,
    lastModifiedBy: "dcaldwell",
    plantIdentity: {
      name: "Generic-1",
      vendor: "Generic Nuclear LLC",
      reactorType: "Sodium-cooled fast reactor (SFR)",
      thermalPower: "300 MWt",
      primaryCoolant: "Liquid sodium",
    },
  },
  conformanceMatrix: [
    cm("ES-A1",  "A", "MET",            BOTH, "Event-tree method applied; each tree frames ESQ and captures all IE/POS/SC combinations."),
    cm("ES-A2",  "A", "MET",            BOTH, "3 radioactive sources identified with 6 barrier sets; each sequence tracks barrier status to its end state."),
    cm("ES-A3",  "A", "MET",            BOTH, "4 reactor-specific safety functions identified with SC linkage for each functional event."),
    cm("ES-A4",  "A", "PARTIAL",        BOTH, "Operator actions identified; HFE-12 time window pending SC v3 re-sync."),
    cm("ES-A5",  "A", "MET",            BOTH, "8 event trees consistent with design T/H analyses and EOPs."),
    cm("ES-A6",  "A", "MET",            BOTH, "Functional events ordered by thermal-hydraulic timing per SC workbook and T/H calculations."),
    cm("ES-A7",  "A", "MET",            BOTH, "41 sequences delineated; 2 screened via SCR-3; all others retained."),
    cm("ES-A8",  "A", "MET",            BOTH, "2 end states: SUCCESSFUL_MITIGATION and RADIONUCLIDE_RELEASE, mapped to 3 release categories."),
    cm("ES-A9",  "A", "MET",            BOTH, "All three radioactive sources (in-core fuel, spent fuel, cover-gas argon) captured in end-state definitions."),
    cm("ES-A10", "A", "MET",            BOTH, "Realistic design-specific T/H analyses (RELAP/SAS, 9 calculations) used for event-progression parameters."),
    cm("ES-A11", "A", "MET",            BOTH, "Plant-response detail matches design information available at pre-operational stage."),
    cm("ES-A12", "A", "PARTIAL",        BOTH, "CC-II: ESF-EARLY bounding check in progress — ESL-04 vs ESF-04 timing difference under review."),
    cm("ES-A13", "A", "PARTIAL",        BOTH, "ATWS transfer defined to ET-ATWS; that tree not yet quantified; dependencies not yet fully preserved at the transfer."),
    cm("ES-A14", "A", "MET",            BOTH, "Model-uncertainty sources documented in the analysis report (→ HLR-ESQ-E)."),
    cm("ES-A15", "A", "MET",            PRE,  "2 pre-operational assumptions logged with closure plans."),
    cm("ES-B1",  "B", "MET",            BOTH, "Initiating-event impacts on systems and barriers identified per event tree."),
    cm("ES-B2",  "B", "MET",            BOTH, "Mitigating-system dependencies (DEP-1 through DEP-6) identified and modelled."),
    cm("ES-B3",  "B", "PARTIAL",        BOTH, "Sodium-fire phenomenological impact (DEP-4) modelled; cable-tray temperature qualification pending."),
    cm("ES-B4",  "B", "MET",            BOTH, "Dependent events (RT before SDHR, DETECT before MAKEUP) placed to the left in all applicable trees."),
    cm("ES-B5",  "B", "MET",            BOTH, "6 inter-system dependencies modelled including DRACS CCF beta-factor."),
    cm("ES-B6",  "B", "MET",            BOTH, "Dependency detail consistent with available design information; assumptions logged."),
    cm("ES-B7",  "B", "MET",            BOTH, "Maintenance-window state-dependent split fraction in POS-04 modelled as DEP-5."),
    cm("ES-B8",  "B", "MET",            BOTH, "2 time-phased dependencies modelled (DEP-3 and DEP-4)."),
    cm("ES-B9",  "B", "MET",            BOTH, "Model-uncertainty sources in dependency analysis identified."),
    cm("ES-B10", "B", "MET",            PRE,  "Pre-operational dependency assumptions logged with closure plans."),
    cm("ES-C1",  "C", "MET",            BOTH, "4 release categories defined; 5 sequence families resolve each one."),
    cm("ES-C2",  "C", "MET",            BOTH, "Physical release characteristics (timing, magnitude, filtration) identified per release category."),
    cm("ES-C3",  "C", "MET",            BOTH, "Event-sequence characteristics leading to each physical release characteristic identified."),
    cm("ES-C4",  "C", "MET",            BOTH, "Each characteristic shown to be addressed in the event-tree delineation."),
    cm("ES-C5",  "C", "MET",            BOTH, "Development method accounts for ES-C2/C3 characteristics and their dependencies."),
    cm("ES-C6",  "C", "MET",            BOTH, "No plant-damage-state interface used; end states map directly to release categories."),
    cm("ES-C7",  "C", "MET",            BOTH, "Plant-response analyses follow HLR-SC-A and HLR-SC-B supporting requirements."),
    cm("ES-C8",  "C", "MET",            BOTH, "5 sequence families resolve each release category; MS hand-off is ready for RC-1 and RC-2."),
    cm("ES-C9",  "C", "MET",            BOTH, "No repair credited in any sequence."),
    cm("ES-C10", "C", "MET",            BOTH, "Model-uncertainty sources in transport analysis identified."),
    cm("ES-C11", "C", "MET",            PRE,  "Pre-operational transport-analysis assumptions logged."),
    cm("ES-D1",  "D", "MET",            BOTH, "ES process documented in the workbook report."),
    cm("ES-D2",  "D", "PARTIAL",        BOTH, "Model uncertainty documented; ATWS and sodium-fire items still open."),
    cm("ES-D3",  "D", "MET",            PRE,  "2 pre-operational assumptions logged with closure plans."),
  ],
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      {
        uuid: "esc-1",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "nhartwell",
        createdAt: "2026-04-28T10:00:00.000Z",
        associatedSr: "ES-A12",
        text: "ESF-EARLY covers ESL-04 and ESF-04 with one chosen sequence (ESR-05), but since their confinement-failure timing differs by hours and changes the source term, CC-II needs you to show one case safely covers the others or split them apart.",
        severity: "MAJOR",
        resolved: false,
      },
      {
        uuid: "esc-2",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "psubram",
        createdAt: "2026-04-28T11:00:00.000Z",
        associatedSr: "ES-B3",
        text: "DEP-4 couples the sodium-pool fire to DRACS actuation and RPS cabling, but its harsh-environment timing (PH-1) is taken from the F-PRA element without confirming the cable-tray qualification temperature; please close that interface before draft (ES-B3).",
        severity: "MINOR",
        resolved: false,
      },
      {
        uuid: "esc-3",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "nhartwell",
        createdAt: "2026-04-28T12:00:00.000Z",
        associatedSr: "ES-A13",
        text: "All ATWS sequences transfer to ET-ATWS, which is not in this workbook yet, so the ESF-ATWS frequency is not final; per ES-A13 the transfer must preserve the functional, operator, and phenomenological links.",
        severity: "MAJOR",
        resolved: false,
      },
      {
        uuid: "esc-4",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "mbeland",
        createdAt: "2026-04-29T09:00:00.000Z",
        associatedSr: "ES-C1",
        text: "The end-state set is clean, with two end states mapping to three release categories that flow cleanly to MS.",
        severity: "OBSERVATION",
        resolved: true,
        resolution: "No change required; mapping confirmed against the MS interface (ES-C1).",
        resolvedAt: "2026-04-29T14:00:00.000Z",
        resolvedBy: "mbeland",
      },
      {
        uuid: "esc-5",
        authorRole: "INTERNAL_REVIEWER",
        authorId: "psubram",
        createdAt: "2026-04-29T10:00:00.000Z",
        associatedSr: "ES-A4",
        text: "Success Criteria v3 revises the DRACS mission time from 72 h to 96 h while HFE-12's time window is still anchored to the old value; please re-sync SC and confirm the operator action still closes before the cladding limit.",
        severity: "MINOR",
        resolved: false,
      },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Internal events, all plant operating states, Generic-1 sodium-cooled fast reactor (pre-operational).",
  scopeDefinition: {
    plantOperatingStateIds: ["POS-01","POS-02","POS-03","POS-04","POS-05","POS-06","POS-07","POS-08","POS-09"],
    initiatingEventIds: ["IEG-TRANS","IEG-LOHS","IEG-LOFA","IEG-RCB","IE-09","IE-11","IE-15","IE-17","IE-18"],
    radioactiveMaterialSources: ["In-core fuel", "Spent fuel (ex-vessel)", "Cover-gas argon"],
    radionuclideBarriers: ["Cladding","Primary boundary","Containment","Cover-gas boundary","Storage cover gas"],
  },
  keySafetyFunctions: [
    "Reactivity control (SF-RC) — shut down the reactor",
    "Decay-heat removal (SF-DHR) — remove post-shutdown heat via intermediate loop or DRACS",
    "Coolant inventory & boundary (SF-INV) — maintain sodium over the core and the primary boundary",
    "Confinement integrity (SF-CONF) — hold back radionuclides if inner barriers are challenged",
  ],
  eventSequences: EVENT_SEQUENCES,
  groupingCriteria: GROUPING_CRITERIA,
  eventSequenceFamilies: SEQUENCE_FAMILIES,
  eventTrees: EVENT_TREES,
  dependencyModels: DEPENDENCY_MODELS,
  releaseCategoryMappings: RELEASE_CATEGORY_MAPPINGS,
  screeningRecords: SCREENING_RECORDS,
  plantResponseAnalysisApproach: "REALISTIC_DESIGN_SPECIFIC",
  plantResponseAnalysisAccuracy: PLANT_REPRESENTATION_ACCURACY,
  plantDamageStatesUsed: false,
  modelUncertainty: {
    uuid: "es-mu-1",
    name: "ES model uncertainty documentation",
    uncertaintySources: [
      { source: "ATWS inherent-reactivity feedback credit", impact: "ESF-ATWS frequency is preliminary; credit from inherent feedback is not yet validated by the ATWS tree calculation." },
      { source: "Sodium-fire cable-tray phenomenological impact (DEP-4)", impact: "Harsh-environment timing taken from F-PRA element without confirming cable-tray qualification temperature; may alter DRACS and RPS success probabilities." },
      { source: "SC v3 DRACS mission time (72 h → 96 h)", impact: "If HFE-12 time window is not updated, operator-action credit in the late-filtered-release sequences may be overstated." },
      { source: "ESF-EARLY representative sequence selection", impact: "ESL-04 and ESF-04 have different confinement-failure timing; single worst-case representative may not bound the source term." },
    ],
    relatedAssumptions: [
      { assumption: "ATWS inherent-reactivity feedback limits power below the cladding-damage threshold.", basis: "Reactor physics calculation (pre-operational design basis); to be confirmed by ATWS-specific tree in ESQ." },
      { assumption: "Cable trays shared by DRACS and RPS are qualified above the sodium-fire temperature.", basis: "Not yet confirmed; target closure: F-PRA interface review Q3 2026." },
    ],
    reasonableAlternatives: [
      { alternative: "Quantify ATWS tree in this workbook rather than ESQ", reasonNotSelected: "ATWS event-tree is part of the ESQ scope per the programme plan; deferred to maintain workbook boundary." },
      { alternative: "Split ESF-EARLY into separate sequences for ESL-04 and ESF-04", reasonNotSelected: "Under review at CC-II; bounding case justification in progress (RC item esc-1)." },
    ],
  },
  preOperationalAssumptions: [
    {
      uuid: "es-pa-1",
      assumptionId: "ES-PA-1",
      status: "OPEN",
      limitations: [],
      description: "DRACS natural-circulation performance taken from prototype-scale test data for the Generic-1 design.",
      influenceOnDefinition: "DRACS success probability in all decay-heat-removal functional events.",
      closureBasis: "Prototype-scale test campaign NR-2023-088.",
      plannedClosureActions: ["Re-baseline after first-of-a-kind integrated DRACS test on Generic-1 commissioning phase 4."],
      affectedElementIds: ["ESL-02","ESR-01","ESF-02","EST-02","ESI-02","ESS-01","ESD-01"],
      riskImpact: ImportanceLevel.MEDIUM,
    },
    {
      uuid: "es-pa-2",
      assumptionId: "ES-PA-2",
      status: "OPEN",
      limitations: [],
      description: "HFE-08 and HFE-12 human error probabilities from a pre-operational HRA based on SC v2 mission times.",
      influenceOnDefinition: "Operator-action success probability in LOHS and related sequences.",
      closureBasis: "SC v3 re-sync and formal HRA programme.",
      plannedClosureActions: ["Update HFE-12 time window once SC v3 is re-synced.", "Re-run HRA with validated timing before fuel load."],
      affectedElementIds: ["ESL-02","ESL-03","ESL-04","ESD-01","ESD-02"],
      riskImpact: ImportanceLevel.MEDIUM,
    },
  ],
  sensitivityStudies: [],
  plantResponseAnalysisReferences: ["TH-CALC-04", "TH-CALC-06", "TH-CALC-09", "TH-CALC-11"],
  documentation: {
    processDescription: "Event sequences were delineated using the event-tree representation with one tree per initiating-event group, functional events ordered by T/H timing, and sequences resolved to end states that hand off to the Mechanistic Source Term element.",
    posInitiatorSequenceLinkage: "Each tree maps to one IE group (or stand-alone initiator) and covers all applicable POS states; POS time fractions from the POS workbook are applied at ESQ quantification.",
    successCriteriaBases: "Success criteria from the SC workbook v2; SC v3 re-sync pending for updated DRACS mission time.",
    keySafetyFunctionsIdentification: "Four safety functions identified from the design basis: reactivity control, decay-heat removal, coolant-inventory / boundary, and confinement integrity.",
    sequenceDelineation: "Sequences delineated to the level needed to resolve each release-category family; 41 sequences across 8 trees; 2 screened via SCR-3.",
    dependencyTreatment: "6 dependencies modelled (functional, CCF, human, phenomenological, operational, physical); 2 are time-phased.",
    endStateAndReleaseCategoryDefinitions: "Two end states: SUCCESSFUL_MITIGATION (safe stable state) and RADIONUCLIDE_RELEASE. Three release categories (RC-1 early, RC-2 late, RC-3 intact confinement).",
    operatorActionsRepresentation: "2 credited operator actions (HFE-08, HFE-12) with feasibility assessments; time windows anchored to T/H timing.",
    deterministicAnalysesUsed: "RELAP/SAS thermal-hydraulic calculations: TH-CALC-04 (reactor trip timing), TH-CALC-06 (LOHS progression), TH-CALC-09 (DRACS natural circulation), TH-CALC-11 (sodium–CO₂ interaction).",
    plantResponseAnalysisBasis: "Realistic, design-specific T/H analyses at CC-II level; pre-operational plant-response approach.",
    intermediateEndStatesAndTransfers: "ATWS sequences transfer to ET-ATWS (not quantified here); transfer condition is reactor trip failure, which must preserve functional and phenomenological dependencies.",
    screeningProcessAndBasis: "Sequences screened using SCR-3: must be slow-developing, alarmed, and corrected before any barrier is challenged. Barrier-breach sequences are retained regardless of frequency.",
    modelUncertaintySources: "4 model-uncertainty sources identified: ATWS credit, sodium-fire cable-tray impact, SC v3 mission-time update, and ESF-EARLY representative-sequence selection.",
    asBuiltLimitations: "Pre-operational analysis; DRACS performance and HFE probabilities close at commissioning.",
    praTaskInterfaces: "Feeds Mechanistic Source Term (MS) with 3 release categories and 5 sequence families. Provides 41 sequences to Event Sequence Quantification (ESQ). Receives IEs and time fractions from IE and POS.",
    implementsSrs: [sr("ES-D1", "D")],
  },
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-041", "NM-028", "NM-045"],
};
