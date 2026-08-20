import {
  OTHER_HAZARDS_PRA_SR_CATALOG,
  type OtherHazardsAnalysisRecord,
  type OtherHazardsPRA,
  type OtherHazardsPraInterfaceRecord,
  type OtherHazardsProcessDocumentation,
} from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { synchronizeOtherHazardsPraDerivedRegisters } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { createBlankOtherHazardsPra } from "../../other-hazards-pra-workbooks/blank-other-hazards-pra";

export type OtherHazardsSeedVariant = "HTGR" | "SFR";

const stamp = "2026-08-14T16:00:00.000Z";
const slug = (variant: OtherHazardsSeedVariant): string => variant.toLowerCase();
const id = (variant: OtherHazardsSeedVariant, code: string): string =>
  `${slug(variant)}-o-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function record<T extends object>(
  variant: OtherHazardsSeedVariant,
  code: string,
  name: string,
  description: string,
  basis: string,
  extra: T,
): OtherHazardsAnalysisRecord & T {
  return {
    uuid: id(variant, code),
    code,
    name,
    description,
    basis,
    owner: "Other Hazards PRA Team",
    status: "READY",
    evidenceRefs: [id(variant, "EVID-STD"), id(variant, "EVID-SITE")],
    relatedRefs: [],
    assumptionRefs: [],
    implementsSrs: [],
    ...extra,
  };
}

function simple(
  variant: OtherHazardsSeedVariant,
  code: string,
  name: string,
  description: string,
  relatedRefs: string[] = [],
): OtherHazardsAnalysisRecord {
  return record(
    variant,
    code,
    name,
    description,
    "The multidisciplinary team verified the record against the controlled model, evidence register, and configuration baseline.",
    { relatedRefs },
  );
}

function documentSection(
  documentation: OtherHazardsProcessDocumentation,
  process: string,
  inputs: string,
  methods: string,
  results: string,
  refs: string[],
): void {
  documentation.processDescription = process;
  documentation.inputsDescription = inputs;
  documentation.methodsDescription = methods;
  documentation.resultsDescription = results;
  documentation.limitations = [
    "Results remain subject to the controlled change-monitoring and pre-operational closure programs.",
  ];
  documentation.supportingDocumentRefs = refs;
  documentation.traceabilityLinks = [
    {
      uuid: `${documentation.uuid}-trace`,
      requirementRef: "Applicable OHA/OFR/OPR requirements",
      inputRefs: refs,
      modelRefs: [],
      resultRefs: [],
      documentationRefs: [documentation.uuid],
    },
  ];
}

type HazardSpec = {
  code: string;
  name: string;
  category: OtherHazardsPRA["retainedHazardGroups"]["hazardGroups"][number]["hazardCategory"];
  subhazards: string[];
  effects: OtherHazardsPRA["retainedHazardGroups"]["hazardGroups"][number]["primaryEffects"];
  intensity: string;
  unit: string;
  sourceType: OtherHazardsPRA["hazardSourceCharacterization"]["hazardSources"][number]["sourceType"];
  source: string;
  distance: number;
  inventory: string;
  mechanism: string;
  location: string;
  values: [number, number, number, number];
  frequencies: [number, number, number, number];
};

const HAZARDS: Record<OtherHazardsSeedVariant, HazardSpec[]> = {
  HTGR: [
    {
      code: "TOX",
      name: "Offsite toxic-gas release",
      category: "HUMAN_INDUCED_EXTERNAL",
      subhazards: ["Chlorine railcar release", "Anhydrous-ammonia highway release", "Industrial toxic plume"],
      effects: ["TOXIC_ASPHYXIANT", "ACCESS_HABITABILITY"],
      intensity: "Time-averaged control-room inlet concentration",
      unit: "ppm chlorine equivalent",
      sourceType: "TRANSPORT_ROUTE",
      source: "Class I freight railroad southwest of the protected area",
      distance: 3.2,
      inventory: "Up to five 90-ton chlorine railcars per consist; current commodity-flow survey",
      mechanism: "Derailment puncture or collision followed by dense-gas release and atmospheric transport",
      location: "Control-room and emergency-filter outside-air intakes",
      values: [2, 10, 25, 100],
      frequencies: [2.4e-4, 7.6e-5, 2.8e-5, 3.2e-6],
    },
    {
      code: "AIR",
      name: "Aircraft impact",
      category: "HUMAN_INDUCED_EXTERNAL",
      subhazards: ["General-aviation crash", "Commercial-aircraft crash", "Military overflight accident"],
      effects: ["IMPACT", "MISSILE", "FIRE"],
      intensity: "Impact kinetic energy",
      unit: "MJ",
      sourceType: "AIR_TRAFFIC",
      source: "Regional airport and overflight corridors",
      distance: 11.8,
      inventory: "38,400 annual general-aviation operations and 9,200 commercial operations",
      mechanism: "Loss of control followed by direct building impact, debris, and aviation-fuel release",
      location: "Reactor building, operations building, and shared heat-removal structures",
      values: [100, 500, 1500, 5000],
      frequencies: [8.5e-7, 2.9e-7, 7.4e-8, 8.1e-9],
    },
    {
      code: "ASH",
      name: "Volcanic ash and regional tephra",
      category: "GEOLOGICAL_OTHER",
      subhazards: ["Fine airborne ash", "Wet ash loading", "Abrasion and electrical contamination"],
      effects: ["BLOCKAGE_FOULING", "HUMIDITY_MOISTURE", "ACCESS_HABITABILITY"],
      intensity: "Deposited ash mass loading",
      unit: "kg/m2",
      sourceType: "NATURAL_PROCESS",
      source: "Cascade volcanic-source region and prevailing transport sectors",
      distance: 410,
      inventory: "Regional tephra-source catalog and Holocene eruption record",
      mechanism: "Explosive eruption, atmospheric transport, deposition, resuspension, and wetting",
      location: "Air-cooled heat exchangers, ventilation intakes, roofs, and outdoor routes",
      values: [0.2, 1, 5, 20],
      frequencies: [1.6e-4, 4.3e-5, 6.8e-6, 5.5e-7],
    },
  ],
  SFR: [
    {
      code: "TOX",
      name: "Offsite ammonia and toxic-gas release",
      category: "HUMAN_INDUCED_EXTERNAL",
      subhazards: [
        "Refrigerated-ammonia release",
        "Chlorine railcar release",
        "Mixed industrial toxic plume",
      ],
      effects: ["TOXIC_ASPHYXIANT", "ACCESS_HABITABILITY"],
      intensity: "Time-averaged control-room inlet concentration",
      unit: "ppm ammonia equivalent",
      sourceType: "FIXED_FACILITY",
      source: "Cold-storage and fertilizer distribution complex west of the site",
      distance: 2.6,
      inventory: "Two 45-ton refrigerated-ammonia vessels plus transfer piping and truck inventory",
      mechanism: "Vessel or transfer-line rupture followed by flashing release and atmospheric dispersion",
      location: "Control-room intake, remote shutdown panel route, and emergency diesel yard",
      values: [10, 50, 150, 500],
      frequencies: [3.1e-4, 9.2e-5, 1.9e-5, 1.8e-6],
    },
    {
      code: "TURB",
      name: "Turbine-generator missile",
      category: "INTERNAL_MECHANICAL",
      subhazards: [
        "Low-trajectory disk fragment",
        "High-trajectory blade fragment",
        "Casing and balance-weight fragment",
      ],
      effects: ["MISSILE", "IMPACT", "VIBRATION"],
      intensity: "Missile impact kinetic energy",
      unit: "MJ",
      sourceType: "PLANT_EQUIPMENT",
      source: "Two turbine-generator trains in the turbine building",
      distance: 0.18,
      inventory: "Rotor disks, blades, balance weights, and overspeed-protection system",
      mechanism: "Overspeed or material defect causes rotor fragmentation and barrier challenge",
      location: "Emergency switchgear, sodium heat-removal support, and control building",
      values: [5, 25, 100, 400],
      frequencies: [6.4e-5, 1.8e-5, 2.9e-6, 2.4e-7],
    },
    {
      code: "SMOKE",
      name: "Regional wildfire smoke and ash",
      category: "METEOROLOGICAL",
      subhazards: ["Dense smoke plume", "Fine particulate loading", "Ember and ash deposition"],
      effects: ["BLOCKAGE_FOULING", "ACCESS_HABITABILITY", "TEMPERATURE"],
      intensity: "One-hour PM2.5 concentration at plant intakes",
      unit: "µg/m3",
      sourceType: "NATURAL_PROCESS",
      source: "Wildland-urban interface surrounding the site",
      distance: 7.5,
      inventory: "Conifer and grass fuel beds mapped over a 50 km influence region",
      mechanism: "Wildfire growth and smoke transport under dry, stable, downslope wind conditions",
      location: "Control-room intake, decay-heat air coolers, diesel intakes, and outdoor routes",
      values: [35, 150, 500, 1500],
      frequencies: [1.8e-2, 4.6e-3, 5.7e-4, 3.9e-5],
    },
  ],
};

const INTERFACES: Array<{
  code: OtherHazardsPraInterfaceRecord["technicalElementCode"];
  name: string;
  direction: OtherHazardsPraInterfaceRecord["direction"];
  payload: OtherHazardsPraInterfaceRecord["payloadType"];
  role: string;
  columns: string[];
}> = [
  {
    code: "HS",
    name: "Hazards Screening Analysis",
    direction: "INPUT",
    payload: "HAZARD_SCREENING_RESULT",
    role: "retained hazard groups, screening bases, secondary-hazard origins, and overlap controls",
    columns: ["Disposition", "Hazard boundary", "Source HSA record", "Controlling origin"],
  },
  {
    code: "POS",
    name: "Plant Operating States Analysis",
    direction: "INPUT",
    payload: "OPERATING_STATE",
    role: "operating-state definitions, durations, frequencies, configurations, and source inventories",
    columns: ["Mode", "Duration", "Entry frequency", "Configuration basis"],
  },
  {
    code: "IE",
    name: "Initiating Event Analysis",
    direction: "INPUT",
    payload: "INITIATING_EVENT",
    role: "baseline initiators, frequencies, group definitions, and hazard-induced initiator destinations",
    columns: ["Initiator", "Baseline frequency", "Hazard change", "Destination"],
  },
  {
    code: "ES",
    name: "Event Sequence Analysis",
    direction: "INPUT",
    payload: "EVENT_SEQUENCE",
    role: "event trees, sequence families, functional events, end states, and source model references",
    columns: ["Event tree", "Functional events", "End states", "Other Hazards treatment"],
  },
  {
    code: "SC",
    name: "Success Criteria Analysis",
    direction: "INPUT",
    payload: "SUCCESS_CRITERION",
    role: "safety-function success criteria, mission times, supporting analyses, and validation records",
    columns: ["Safety function", "Criterion", "Mission time", "Supporting analysis"],
  },
  {
    code: "SY",
    name: "Systems Analysis",
    direction: "INPUT",
    payload: "SYSTEM_MODEL",
    role: "system logic, basic events, dependencies, support systems, and model version",
    columns: ["System", "Basic events", "Support dependencies", "Model revision"],
  },
  {
    code: "HR",
    name: "Human Reliability Analysis",
    direction: "INPUT",
    payload: "HUMAN_FAILURE_EVENT",
    role: "baseline actions, failure events, recovery models, procedures, and dependency groups",
    columns: ["Action", "HFE", "Baseline HEP", "Procedure"],
  },
  {
    code: "DA",
    name: "Data Analysis",
    direction: "INPUT",
    payload: "DATA_PARAMETER",
    role: "equipment reliability, common cause, recovery, uncertainty distributions, and data provenance",
    columns: ["Parameter", "Mean", "Distribution", "Data source"],
  },
  {
    code: "F",
    name: "Internal Fire PRA",
    direction: "INPUT",
    payload: "SECONDARY_HAZARD",
    role: "accepted hazard-induced fire scenarios and fire damage, suppression, and sequence results",
    columns: ["Origin hazard", "Fire scenario", "Affected targets", "Acceptance status"],
  },
  {
    code: "FL",
    name: "Internal Flood PRA",
    direction: "INPUT",
    payload: "SECONDARY_HAZARD",
    role: "accepted hazard-induced internal-flood sources, propagation, damaged SSCs, and sequence results",
    columns: ["Origin hazard", "Flood scenario", "Affected areas", "Acceptance status"],
  },
  {
    code: "XF",
    name: "External Flood PRA",
    direction: "INPUT",
    payload: "SECONDARY_HAZARD",
    role: "accepted externally generated flooding mechanisms, spatial fields, fragilities, and overlap controls",
    columns: ["Origin hazard", "Flood mechanism", "Hazard result", "Acceptance status"],
  },
  {
    code: "S",
    name: "Seismic PRA",
    direction: "INPUT",
    payload: "SECONDARY_HAZARD",
    role: "earthquake-induced Other Hazards scenarios, shared source conditions, and dependent-failure treatment",
    columns: ["Seismic origin", "Other hazard", "Dependency", "Model destination"],
  },
  {
    code: "W",
    name: "High Winds PRA",
    direction: "INPUT",
    payload: "SECONDARY_HAZARD",
    role: "storm-induced Other Hazards scenarios, warning conditions, and correlated plant damage",
    columns: ["Wind origin", "Other hazard", "Shared conditions", "Model destination"],
  },
  {
    code: "ESQ",
    name: "Event Sequence Quantification",
    direction: "OUTPUT",
    payload: "SEQUENCE_FAMILY_RESULT",
    role: "hazard-interval conditional probabilities and sequence-family frequencies",
    columns: ["Sequence family", "Mean /yr", "5th percentile", "95th percentile"],
  },
  {
    code: "MS",
    name: "Mechanistic Source Term",
    direction: "OUTPUT",
    payload: "PLANT_DAMAGE_STATE",
    role: "hazard damage attributes, confinement conditions, plant-damage states, and timing",
    columns: ["Damage state", "Confinement status", "Hazard attributes", "Timing"],
  },
  {
    code: "RC",
    name: "Release Category",
    direction: "OUTPUT",
    payload: "RELEASE_CATEGORY",
    role: "Other Hazards sequence mappings, release categories, dependency attributes, and frequencies",
    columns: ["Sequence family", "Release category", "Dependency attributes", "Mean /yr"],
  },
  {
    code: "RI",
    name: "Risk Integration",
    direction: "OUTPUT",
    payload: "RISK_CONTRIBUTOR",
    role: "plant-year results, uncertainty percentiles, dominant contributors, decisions, and overlap controls",
    columns: ["Risk metric", "Mean /yr", "Dominant contributor", "Overlap treatment"],
  },
  {
    code: "CC",
    name: "Configuration Control",
    direction: "OUTPUT",
    payload: "CONFIGURATION_BASELINE",
    role: "controlled model, report, evidence manifest, limitations, peer-review record, and reanalysis triggers",
    columns: ["Model version", "Control record", "Package manifest", "Release status"],
  },
];

interface InterfaceTransferSeed {
  name: string;
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: [string, string, string, string];
}

function interfaceTransferRows(
  variant: OtherHazardsSeedVariant,
  code: OtherHazardsPraInterfaceRecord["technicalElementCode"],
): InterfaceTransferSeed[] {
  const htgr = variant === "HTGR";
  const toxic = htgr ? "Chlorine rail release" : "Refrigerated-ammonia release";
  const impact = htgr ? "Aircraft impact" : "Turbine-generator missile";
  const airborne = htgr ? "Volcanic ash loading" : "Wildfire smoke and ash";
  const heatRemoval = htgr ? "Reactor cavity cooling" : "Direct reactor auxiliary cooling";
  const powerState = htgr ? "Four-module full-power operation" : "Two-unit full-power operation";
  const outageState =
    htgr ? "Module refueling with shared systems aligned" : "Unit maintenance with fuel handling active";
  const rows: Record<string, InterfaceTransferSeed[]> = {
    HS: [
      {
        name: toxic,
        recordRef: `HS-${variant}-O-TOX`,
        sourceModelRef: `HS-${variant}-FINAL-R4`,
        destinationRefs: [id(variant, "O-HG-TOX")],
        values: [
          "RETAINED_QUANTITATIVE",
          "Source occurrence through toxic dose and habitability response",
          `HS-${variant}-O-TOX`,
          "HS origin; induced fire retained only by Fire PRA",
        ],
      },
      {
        name: impact,
        recordRef: `HS-${variant}-O-IMPACT`,
        sourceModelRef: `HS-${variant}-FINAL-R4`,
        destinationRefs: [id(variant, htgr ? "O-HG-AIR" : "O-HG-TURB")],
        values: [
          "RETAINED_QUANTITATIVE",
          "Missile/impact demand, structural damage, and dependent plant response",
          `HS-${variant}-O-IMPACT`,
          "HS origin; consequential fires transferred to Fire PRA",
        ],
      },
      {
        name: airborne,
        recordRef: `HS-${variant}-O-AIRBORNE`,
        sourceModelRef: `HS-${variant}-FINAL-R4`,
        destinationRefs: [id(variant, htgr ? "O-HG-ASH" : "O-HG-SMOKE")],
        values: [
          "RETAINED_QUANTITATIVE",
          "Airborne concentration/deposition through intake blockage and access effects",
          `HS-${variant}-O-AIRBORNE`,
          "HS origin; coincident wind or precipitation controlled by overlap tags",
        ],
      },
    ],
    POS: [
      {
        name: powerState,
        recordRef: "POS-01-POWER",
        sourceModelRef: `${variant}-POS-R6`,
        destinationRefs: [id(variant, "O-SCOPE-001")],
        values: [
          "Power operation",
          "7,972 h/plant-year",
          "1.00 /plant-year",
          htgr ?
            "All modules at rated power; shared heat rejection available"
          : "Both units at rated power; normal decay-heat trains aligned",
        ],
      },
      {
        name: "Hot shutdown and cooldown",
        recordRef: "POS-03-HOT-SHUTDOWN",
        sourceModelRef: `${variant}-POS-R6`,
        destinationRefs: [id(variant, "O-SCOPE-001")],
        values: [
          "Shutdown/cooldown",
          "286 h/plant-year",
          "3.2 /plant-year",
          "Reduced inventory margins; temporary ventilation and electrical alignments represented",
        ],
      },
      {
        name: outageState,
        recordRef: htgr ? "POS-04-REFUELING" : "POS-04-MAINTENANCE",
        sourceModelRef: `${variant}-POS-R6`,
        destinationRefs: [id(variant, "O-SCOPE-001")],
        values: [
          "Outage/refueling",
          "438 h/plant-year",
          "1.4 /plant-year",
          "Open equipment, temporary services, fuel-movement source, and outage staffing included",
        ],
      },
    ],
    IE: [
      {
        name: "Loss of offsite power",
        recordRef: "IE-LOOP-ALL",
        sourceModelRef: `${variant}-IE-R6`,
        destinationRefs: [id(variant, "O-IE-001")],
        values: [
          "LOOP",
          "1.1E-2 /reactor-year",
          "Conditional initiator after impact, ash/smoke fouling, or toxic-source isolation",
          "Other Hazards event-sequence trees",
        ],
      },
      {
        name: `Loss of ${heatRemoval.toLowerCase()}`,
        recordRef: "IE-LOSS-DHR",
        sourceModelRef: `${variant}-IE-R6`,
        destinationRefs: [id(variant, "O-IE-002")],
        values: [
          "Loss of decay-heat removal",
          "3.6E-3 /reactor-year",
          "Hazard-induced correlated train failures replace the baseline initiator frequency",
          "Other Hazards plant-response model",
        ],
      },
      {
        name: "Control-room habitability challenge",
        recordRef: "IE-HAB-CHALLENGE",
        sourceModelRef: `${variant}-IE-R6`,
        destinationRefs: [id(variant, "O-IE-003")],
        values: [
          "Habitability challenge",
          "Not a baseline initiator",
          `New initiator for ${toxic.toLowerCase()} and ${airborne.toLowerCase()}`,
          "Other Hazards HRA and event sequences",
        ],
      },
    ],
    ES: [
      {
        name: "Hazard-induced LOOP response",
        recordRef: "ES-LOOP-O",
        sourceModelRef: `${variant}-ES-R6`,
        destinationRefs: [id(variant, "O-ES-001")],
        values: [
          "ET-LOOP-R6",
          "Trip; AC recovery; decay-heat removal; long-term cooling",
          "Safe stable state; controlled release; release category",
          "Adds hazard interval, correlated SSC failures, and impaired recovery",
        ],
      },
      {
        name: "Loss of heat rejection response",
        recordRef: "ES-HEAT-REJECT-O",
        sourceModelRef: `${variant}-ES-R6`,
        destinationRefs: [id(variant, "O-ES-002")],
        values: [
          "ET-DHR-R6",
          `Trip; ${heatRemoval}; alternate cooling; inventory control`,
          "Stable shutdown; plant-damage states PDS-O-1 through PDS-O-3",
          "Adds intake blockage/impact damage and multi-unit resource demand",
        ],
      },
      {
        name: "Habitability and command response",
        recordRef: "ES-HAB-O",
        sourceModelRef: `${variant}-ES-R6`,
        destinationRefs: [id(variant, "O-ES-003")],
        values: [
          "ET-HAB-R3",
          "Detect; isolate; filter; relocate; remote shutdown",
          "Habitable control; remote control; loss of command",
          "New hazard-specific tree with timing and personnel fragility",
        ],
      },
    ],
    SC: [
      {
        name: `${heatRemoval} success criterion`,
        recordRef: "SC-DHR-O",
        sourceModelRef: `${variant}-SC-R5`,
        destinationRefs: [id(variant, "O-SC-001")],
        values: [
          "Decay heat removal",
          htgr ? "2 of 4 independent module heat-removal paths" : "1 of 3 trains per affected unit",
          "72 h initial; 168 h long-term",
          `${variant}-TH-CALC-014 R3 validated for hazard mission conditions`,
        ],
      },
      {
        name: "Essential AC/DC power criterion",
        recordRef: "SC-POWER-O",
        sourceModelRef: `${variant}-SC-R5`,
        destinationRefs: [id(variant, "O-SC-002")],
        values: [
          "Electrical support",
          "One protected AC division and its associated DC/instrument supply",
          "24 h battery-supported; 72 h fuel-supported",
          "Load-flow and battery-depletion calculation EL-208 R5",
        ],
      },
      {
        name: "Protected command-and-control criterion",
        recordRef: "SC-HAB-O",
        sourceModelRef: `${variant}-SC-R5`,
        destinationRefs: [id(variant, "O-SC-003")],
        values: [
          "Control-room habitability",
          "Automatic isolation plus one filtration train, or successful remote-shutdown transfer",
          "12 h plume; 72 h occupied mission",
          "Habitability calculation HAB-001 R5 and timed action validation",
        ],
      },
    ],
    SY: [
      {
        name: heatRemoval,
        recordRef: "SY-DHR-O",
        sourceModelRef: `${variant}-SY-R8`,
        destinationRefs: [id(variant, "O-SY-001")],
        values: [
          heatRemoval,
          "Fans/valves, heat exchangers, intake paths, power and control basic events",
          "Essential power; structures; ventilation/intake protection",
          "R8 with O-fragility hooks and common-demand groups",
        ],
      },
      {
        name: "Essential electrical power",
        recordRef: "SY-EPS-O",
        sourceModelRef: `${variant}-SY-R8`,
        destinationRefs: [id(variant, "O-SY-002")],
        values: [
          "Essential AC and DC power",
          "Diesels/inverters, switchgear, batteries, distribution and recovery events",
          "Fuel oil; service water/air; HVAC; operator recovery",
          "R8 with impact, fouling, toxic-access, and correlation logic",
        ],
      },
      {
        name: "Control-room emergency ventilation",
        recordRef: "SY-CREV-O",
        sourceModelRef: `${variant}-SY-R8`,
        destinationRefs: [id(variant, "O-SY-003")],
        values: [
          "Emergency ventilation and isolation",
          "Detectors, dampers, fans, filters, leakage, power and manual actions",
          "Instrument power; habitability boundary; operator cues",
          "R8 with concentration-dependent failure and delayed detection",
        ],
      },
    ],
    HR: [
      {
        name: "Isolate outside-air intakes",
        recordRef: "HFE-ISO-INTAKE",
        sourceModelRef: `${variant}-HR-R5`,
        destinationRefs: [id(variant, "O-HA-001")],
        values: [
          "Diagnose hazard and isolate control-room intake",
          "HFE-ISO-INTAKE",
          "2.0E-2",
          "AOP-HAZ-01 and control-room alarm response",
        ],
      },
      {
        name: `Align alternate ${heatRemoval.toLowerCase()}`,
        recordRef: "HFE-ALIGN-DHR",
        sourceModelRef: `${variant}-HR-R5`,
        destinationRefs: [id(variant, "O-HA-002")],
        values: [
          "Align protected alternate cooling path",
          "HFE-ALIGN-DHR",
          "3.0E-2",
          "EOP-DHR-02 with hazard-specific access supplement",
        ],
      },
      {
        name: "Establish protected local response",
        recordRef: "HFE-PPE-LOCAL",
        sourceModelRef: `${variant}-HR-R5`,
        destinationRefs: [id(variant, "O-HA-003")],
        values: [
          "Don respiratory PPE and perform local isolation/recovery",
          "HFE-PPE-LOCAL",
          "5.0E-2",
          "AOP-HAZ-03; two-person supplied-air entry procedure",
        ],
      },
    ],
    DA: [
      {
        name: "Ventilation isolation train failure",
        recordRef: "DA-CREV-ISO",
        sourceModelRef: `${variant}-DA-2025`,
        destinationRefs: [id(variant, "O-DP-001")],
        values: [
          "Failure on demand of one isolation train",
          "1.8E-3 /demand",
          "Beta(5.4, 2995); mean and 5th/95th propagated",
          "Plant demand history 2012-2025 plus industry ventilation data",
        ],
      },
      {
        name: "Emergency power common-cause failure",
        recordRef: "DA-EPS-CCF",
        sourceModelRef: `${variant}-DA-2025`,
        destinationRefs: [id(variant, "O-DP-002")],
        values: [
          "Diesel or inverter CCF alpha factor",
          "2.6E-2 conditional fraction",
          "Dirichlet posterior; 2,000 uncertainty samples",
          "Plant/industry CCF database through 2025",
        ],
      },
      {
        name: "Offsite-power recovery",
        recordRef: "DA-LOOP-REC",
        sourceModelRef: `${variant}-DA-2025`,
        destinationRefs: [id(variant, "O-DP-003")],
        values: [
          "Hazard-conditioned LOOP nonrecovery at 8 h",
          "0.34",
          "Lognormal repair-time mixture by damage class",
          "Regional utility restoration data with severe-event adjustment",
        ],
      },
    ],
    F: [
      {
        name: `${impact} consequential fire`,
        recordRef: `F-${variant}-O-IMPACT`,
        sourceModelRef: `${variant}-FIRE-R3`,
        destinationRefs: [id(variant, "O-SEC-001")],
        values: [
          impact,
          "Fuel/lubricant release with ignition following structural or equipment impact",
          "Cable routes, emergency power, ventilation and adjacent safety divisions",
          "Accepted in Fire PRA; origin and conditional ignition retained in O",
        ],
      },
      {
        name: `${toxic} secondary ignition`,
        recordRef: `F-${variant}-O-TOX`,
        sourceModelRef: `${variant}-FIRE-R3`,
        destinationRefs: [id(variant, "O-SEC-002")],
        values: [
          toxic,
          "Flammable co-release or vehicle fire at the source/transport corridor",
          "Outdoor intakes, access routes and exposed support equipment",
          "Fire damage quantified in Fire PRA; toxic plume remains in O",
        ],
      },
      {
        name: `${airborne} fire interaction`,
        recordRef: `F-${variant}-O-AIRBORNE`,
        sourceModelRef: `${variant}-FIRE-R3`,
        destinationRefs: [id(variant, "O-SEC-003")],
        values: [
          airborne,
          htgr ?
            "Ash-induced electrical fault and localized cabinet fire"
          : "Wildfire ember intrusion and outdoor exposure fire",
          "Ventilation, electrical rooms, heat-rejection equipment and operator routes",
          "Accepted with common weather/source dependency preserved",
        ],
      },
    ],
    FL: [
      {
        name: `${impact} induced pipe rupture`,
        recordRef: `FL-${variant}-O-IMPACT`,
        sourceModelRef: `${variant}-FL-R4`,
        destinationRefs: [id(variant, "O-SEC-004")],
        values: [
          impact,
          "Impact damages service-water/fire-water piping and releases inventory",
          "Turbine/auxiliary building drainage areas and cable trenches",
          "Accepted in Internal Flood PRA; impact origin retained in O",
        ],
      },
      {
        name: `${toxic} mitigation-water ingress`,
        recordRef: `FL-${variant}-O-TOX`,
        sourceModelRef: `${variant}-FL-R4`,
        destinationRefs: [id(variant, "O-SEC-005")],
        values: [
          toxic,
          "Emergency washdown or deluge drains through connected internal pathways",
          "Intake plenum, support building and below-grade electrical spaces",
          "Bounded in FL; no independent flood initiator added",
        ],
      },
      {
        name: `${airborne} drainage blockage`,
        recordRef: `FL-${variant}-O-AIRBORNE`,
        sourceModelRef: `${variant}-FL-R4`,
        destinationRefs: [id(variant, "O-SEC-006")],
        values: [
          airborne,
          "Ash/debris blocks roof drains and produces internal leakage",
          "Roof penetrations, ventilation rooms and electrical cabinets",
          "Conditional leakage quantified in FL with O-origin tag",
        ],
      },
    ],
    XF: [
      {
        name: "Shared severe-weather precipitation",
        recordRef: `XF-${variant}-O-WEATHER`,
        sourceModelRef: `${variant}-XF-R3`,
        destinationRefs: [id(variant, "O-COMB-001")],
        values: [
          airborne,
          "Coincident intense precipitation and site ponding",
          "Location-specific flood intervals and protected access states",
          "XF owns hydraulic response; O owns smoke/ash effects",
        ],
      },
      {
        name: "Offsite hazardous-material mobilization",
        recordRef: `XF-${variant}-O-MOBILIZE`,
        sourceModelRef: `${variant}-XF-R3`,
        destinationRefs: [id(variant, "O-COMB-002")],
        values: [
          toxic,
          "Flood mobilizes industrial or transport-route chemicals",
          "Source-zone conditional release and site-access challenge",
          "Joint frequency retained once under controlling flood origin",
        ],
      },
      {
        name: "Flood-isolated site recovery",
        recordRef: `XF-${variant}-O-ACCESS`,
        sourceModelRef: `${variant}-XF-R3`,
        destinationRefs: [id(variant, "O-COMB-003")],
        values: [
          impact,
          "Flooded roads restrict emergency support following the primary hazard",
          "North and west access routes; recovery-resource arrival",
          "XF route-state supplied to O HRA without duplicate flood risk",
        ],
      },
    ],
    S: [
      {
        name: "Earthquake-induced toxic release",
        recordRef: `S-${variant}-O-TOX`,
        sourceModelRef: `${variant}-S-R5`,
        destinationRefs: [id(variant, "O-COMB-004")],
        values: [
          "Seismic source bin S-04",
          toxic,
          "Shared ground-motion bin controls source rupture and plant SSC damage",
          "Seismic sequence model with O toxic-response fragilities",
        ],
      },
      {
        name: "Seismically induced impact/missile",
        recordRef: `S-${variant}-O-IMPACT`,
        sourceModelRef: `${variant}-S-R5`,
        destinationRefs: [id(variant, "O-COMB-005")],
        values: [
          "Seismic source bin S-05",
          impact,
          "Equipment support failure and target damage are conditionally dependent",
          "Seismic plant-response model; O supplies effect/fragility basis",
        ],
      },
      {
        name: "Earthquake-induced regional access hazard",
        recordRef: `S-${variant}-O-ACCESS`,
        sourceModelRef: `${variant}-S-R5`,
        destinationRefs: [id(variant, "O-COMB-006")],
        values: [
          "Seismic source bin S-03",
          "Landslide, road blockage, and offsite support delay",
          "Common event timing affects recovery and staffing",
          "Seismic HRA/recovery model with O source characterization",
        ],
      },
    ],
    W: [
      {
        name: "Wind-induced toxic-source failure",
        recordRef: `W-${variant}-O-TOX`,
        sourceModelRef: `${variant}-W-R4`,
        destinationRefs: [id(variant, "O-COMB-007")],
        values: [
          "Tornado interval T-04",
          toxic,
          "Common storm warning, LOOP, debris, and access conditions",
          "High Winds origin; O supplies dispersion and habitability response",
        ],
      },
      {
        name: "Wind-driven source missile interaction",
        recordRef: `W-${variant}-O-IMPACT`,
        sourceModelRef: `${variant}-W-R4`,
        destinationRefs: [id(variant, "O-COMB-008")],
        values: [
          "Tornado interval T-05",
          impact,
          "Wind missile and source/equipment damage share the same track geometry",
          "High Winds missile model with O source consequence attributes",
        ],
      },
      {
        name: "Storm-correlated airborne loading",
        recordRef: `W-${variant}-O-AIRBORNE`,
        sourceModelRef: `${variant}-W-R4`,
        destinationRefs: [id(variant, "O-COMB-009")],
        values: [
          "Straight-wind/tropical interval W-03",
          airborne,
          "Shared wind field controls transport, intake demand, and operator access",
          "One controlling wind origin; O supplies non-wind airborne effects",
        ],
      },
    ],
    ESQ: [
      {
        name: `${toxic} sequence-family result`,
        recordRef: `O-ESF-${variant}-TOX`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`ESQ-${variant}-O-TOX`],
        values: [
          "Loss of habitability / protected command",
          htgr ? "6.2E-7" : "8.1E-7",
          htgr ? "1.4E-7" : "1.8E-7",
          htgr ? "2.3E-6" : "3.0E-6",
        ],
      },
      {
        name: `${impact} sequence-family result`,
        recordRef: `O-ESF-${variant}-IMPACT`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`ESQ-${variant}-O-IMPACT`],
        values: [
          "Correlated impact damage / loss of heat removal",
          htgr ? "2.7E-7" : "5.6E-7",
          htgr ? "5.1E-8" : "1.2E-7",
          htgr ? "1.1E-6" : "2.2E-6",
        ],
      },
      {
        name: `${airborne} sequence-family result`,
        recordRef: `O-ESF-${variant}-AIRBORNE`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`ESQ-${variant}-O-AIRBORNE`],
        values: [
          "Intake blockage / degraded protected response",
          htgr ? "1.8E-7" : "7.4E-7",
          htgr ? "3.7E-8" : "1.6E-7",
          htgr ? "7.6E-7" : "2.8E-6",
        ],
      },
    ],
    MS: [
      {
        name: "PDS-O-1 protected shutdown",
        recordRef: `PDS-${variant}-O-1`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`MS-${variant}-O-1`],
        values: [
          "PDS-O-1: heat removal retained",
          "Confinement intact; normal leakage",
          "External toxic/impact/airborne challenge with one protected train",
          "Immediate trip; stable state within 8 h",
        ],
      },
      {
        name: "PDS-O-2 degraded heat removal",
        recordRef: `PDS-${variant}-O-2`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`MS-${variant}-O-2`],
        values: [
          "PDS-O-2: delayed/degraded heat removal",
          "Confinement challenged but isolated",
          "Correlated support loss and impaired local recovery",
          "Damage within 2 h; stabilization 24-72 h",
        ],
      },
      {
        name: "PDS-O-3 loss of protected functions",
        recordRef: `PDS-${variant}-O-3`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`MS-${variant}-O-3`],
        values: [
          "PDS-O-3: protected response unavailable",
          "Confinement bypass or leakage possible",
          "Multi-unit/common-source damage and command impairment",
          "Progression attributes supplied at 1, 8, 24, and 72 h",
        ],
      },
    ],
    RC: [
      {
        name: "RC-O-1 no/controlled release",
        recordRef: `RC-${variant}-O-1`,
        sourceModelRef: `${variant}-RC-R3`,
        destinationRefs: [`RI-${variant}-RC-O-1`],
        values: [
          "Protected shutdown families",
          "RC-O-1",
          "Confinement intact; successful isolation; no shared support loss",
          htgr ? "5.1E-7" : "9.4E-7",
        ],
      },
      {
        name: "RC-O-2 delayed filtered release",
        recordRef: `RC-${variant}-O-2`,
        sourceModelRef: `${variant}-RC-R3`,
        destinationRefs: [`RI-${variant}-RC-O-2`],
        values: [
          "Degraded heat-removal families",
          "RC-O-2",
          "Delayed progression; confinement isolated; filtered pathway available",
          htgr ? "3.7E-7" : "7.6E-7",
        ],
      },
      {
        name: "RC-O-3 early/unfiltered release",
        recordRef: `RC-${variant}-O-3`,
        sourceModelRef: `${variant}-RC-R3`,
        destinationRefs: [`RI-${variant}-RC-O-3`],
        values: [
          "Loss of protected-function families",
          "RC-O-3",
          "Impact/bypass or command loss with correlated support failures",
          htgr ? "1.9E-7" : "4.0E-7",
        ],
      },
    ],
    RI: [
      {
        name: "Total Other Hazards plant-year result",
        recordRef: `RI-${variant}-O-TOTAL`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`RI-${variant}-TOTAL-RISK`],
        values: [
          "Other Hazards sequence-family frequency",
          htgr ? "1.07E-6 /plant-year" : "2.10E-6 /plant-year",
          toxic,
          "Exclusive origin tags remove Fire, Flood, Seismic, High Winds, and IE duplication",
        ],
      },
      {
        name: "Dominant Other Hazards contributor",
        recordRef: `RI-${variant}-O-DOM`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`RI-${variant}-CONTRIBUTORS`],
        values: [
          "Dominant sequence contribution",
          htgr ? "6.2E-7 /plant-year" : "8.1E-7 /plant-year",
          `${toxic} with delayed intake isolation`,
          "Secondary effects counted by accepting element and linked to O origin",
        ],
      },
      {
        name: "Other Hazards uncertainty result",
        recordRef: `RI-${variant}-O-UNC`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`RI-${variant}-UNCERTAINTY`],
        values: [
          "5th / mean / 95th plant-year result",
          htgr ? "2.5E-7 / 1.07E-6 / 4.0E-6" : "4.8E-7 / 2.10E-6 / 7.8E-6",
          "Hazard-tail and functional fragility uncertainty",
          "Shared uncertainty samples retained across correlated technical elements",
        ],
      },
    ],
    CC: [
      {
        name: "Other Hazards model baseline",
        recordRef: `${variant}-CC-O-001`,
        sourceModelRef: `${variant}-O-MODEL-1.0`,
        destinationRefs: [`CC-${variant}-O-MODEL`],
        values: [
          `${variant}-O-MODEL-1.0`,
          `${variant}-CC-O-001`,
          "MEF JSON, solver model, data tables, uncertainty seed, and verification logs",
          "RELEASED FOR INTERNAL APPROVAL",
        ],
      },
      {
        name: "Other Hazards report and evidence package",
        recordRef: `${variant}-CC-O-002`,
        sourceModelRef: `${variant}-O-REPORT-R1`,
        destinationRefs: [`CC-${variant}-O-REPORT`],
        values: [
          `${variant}-O-REPORT-R1`,
          `${variant}-CC-O-002`,
          "Controlled report, calculations, drawings, investigation log, photos, and interface manifest",
          "REVIEW COMPLETE",
        ],
      },
      {
        name: "Other Hazards limitations and triggers",
        recordRef: `${variant}-CC-O-003`,
        sourceModelRef: `${variant}-O-REGISTER-R2`,
        destinationRefs: [`CC-${variant}-O-TRIGGERS`],
        values: [
          `${variant}-O-LIMIT-REGISTER-R2`,
          `${variant}-CC-O-003`,
          "Open assumptions, closure evidence, source-change thresholds, and reanalysis triggers",
          "CONTROLLED; annual source-monitoring review required",
        ],
      },
    ],
  };
  return rows[code] ?? [];
}

export function createOtherHazardsPraSeed(variant: OtherHazardsSeedVariant): OtherHazardsPRA {
  const htgr = variant === "HTGR";
  const hazards = HAZARDS[variant];
  const plantName = htgr ? "Pioneer Generating Station" : "Aurora Sodium Energy Center";
  const siteName = htgr ? "Cedar Plains Reference Site" : "North River Reference Site";
  const units =
    htgr ?
      ["HTGR-MODULE-01", "HTGR-MODULE-02", "HTGR-MODULE-03", "HTGR-MODULE-04"]
    : ["SFR-UNIT-01", "SFR-UNIT-02"];
  const sources =
    htgr ?
      [...units.map((unit) => `${unit}-REACTOR-INVENTORY`), "HTGR-SPENT-FUEL"]
    : [...units.map((unit) => `${unit}-REACTOR-INVENTORY`), "SFR-FUEL-STORAGE"];
  const pos =
    htgr ?
      ["POS-01-POWER", "POS-02-STARTUP", "POS-03-HOT-SHUTDOWN", "POS-04-REFUELING"]
    : ["POS-01-POWER", "POS-02-LOW-POWER", "POS-03-HOT-SHUTDOWN", "POS-04-MAINTENANCE"];
  const mef = createBlankOtherHazardsPra(`${plantName} Other Hazards PRA`, "Other Hazards PRA Lead");
  mef.uuid = id(variant, "MEF");
  mef.version = "1.0";
  mef.created = stamp;
  mef.modified = stamp;
  mef.plantStage = "PRE_OPERATIONAL";
  mef.capabilityCategory = "CC-II";
  mef.praScope = `Capability Category II Other Hazards PRA for ${plantName}, covering ${pos.length} representative operating states, ${units.length} reactor units or modules, ${sources.length} radioactive-material sources, shared site systems, and all HSA-retained hazards not assigned wholly to a specialized PRA.`;
  mef.metadata = {
    ...mef.metadata,
    versionInfo: { version: "1.0", lastUpdated: stamp, schemaVersion: "1.0.0" },
    analysisDate: stamp,
    analysts: [
      "R. Chen — hazard analyst",
      "M. Okafor — fragility lead",
      "L. Martinez — systems/HRA lead",
      "S. Patel — quantification lead",
    ],
    reviewers: [
      {
        id: `${variant}-O-REVIEW-TEAM`,
        name: "Independent Other Hazards peer-review team",
        role: "EXTERNAL_PEER_REVIEWER",
        organization: "Independent PRA Review Group",
      },
    ],
    scope: mef.praScope,
    limitations: [
      "Final offsite commodity-flow survey and selected as-built detector locations are controlled pre-operational items.",
    ],
    lastModifiedDate: stamp,
    lastModifiedBy: "Other Hazards PRA Lead",
    plantIdentity: {
      name: plantName,
      siteName,
      vendor: htgr ? "Generic modular HTGR designer" : "Generic pool-type SFR designer",
      reactorType: htgr ? "Modular high-temperature gas-cooled reactor" : "Pool-type sodium fast reactor",
      thermalPower: htgr ? "4 × 350 MWt" : "2 × 840 MWt",
      primaryCoolant: htgr ? "Helium" : "Liquid sodium",
      numberOfModules: units.length,
    },
  };
  mef.configurationControlRecordId = `${variant}-CC-O-001`;

  mef.analysisBasis.siteBasis = record(
    variant,
    "O-SITE-001",
    `${siteName} analysis basis`,
    "Defines the specific reference site, controlled data cutoff, regional setting, nearby hazard sources, plant scope, and physical boundary used by every Other Hazards subelement.",
    "Site selection, geographic data, design information, HSA records, and the current configuration index establish a representative and internally consistent CC-II basis.",
    {
      siteBasisType: "SPECIFIC_SITE",
      siteName,
      latitudeDegrees: htgr ? 35.907 : 46.184,
      longitudeDegrees: htgr ? -96.461 : -119.287,
      elevationMetres: htgr ? 284 : 162,
      siteSelectionStatus: "SELECTED",
      boundingSiteRefs: [],
      boundingCharacteristics: [],
      regionalSettingDescription:
        htgr ?
          "Inland mixed agricultural and industrial region with freight rail, a regional airport, distant volcanic sources, and low rolling terrain."
        : "Inland river-valley energy corridor bordered by dry forest, industrial cold storage, freight routes, and low relief uplands.",
      terrainAndTopographyDescription:
        htgr ?
          "Gently rolling terrain; 22 m total relief within 5 km; no terrain barrier credited for toxic dispersion."
        : "Broad river terrace with a 14 m western escarpment; drainage and wind-channeling effects retained without favorable shielding credit.",
      nearbyFacilityAndTransportDescription: hazards
        .map((hazard) => `${hazard.source} (${hazard.distance} km)`)
        .join("; "),
      licenseeControlledAreaDescription:
        "The owner-controlled area extends to the surveyed property boundary; offsite sources are evaluated through a conservative 80 km screening region and source-specific influence areas.",
      reactorUnitRefs: units,
      radioactiveMaterialSourceRefs: sources,
      plantOperatingStateRefs: pos,
      multiReactorOrMultiSourceLocations: [...units, ...sources],
      analysisDateCutoff: "2026-06-30",
    },
  ) as NonNullable<OtherHazardsPRA["analysisBasis"]["siteBasis"]>;
  mef.analysisBasis.applications = [
    record(
      variant,
      "O-APP-001",
      "Full-scope PRA and design decision support",
      "Supports baseline risk integration, design vulnerability review, emergency planning inputs, configuration decisions, and future risk-informed applications.",
      "The application requires a realistic CC-II hazard-to-consequence model with uncertainty and plant-year results.",
      {
        purpose:
          "Quantify retained Other Hazards risk and identify practical design, procedural, monitoring, and configuration improvements.",
        decisionContext:
          "Reference-design completion, pre-operational readiness, full-scope PRA integration, and controlled future plant changes.",
        supportedRiskMetrics: [
          "Event-sequence-family frequency per plant-year",
          "Plant-damage-state frequency",
          "Release-category frequency",
          "Mean and 5th/95th percentile results",
        ],
        consumingElementRefs: ["ESQ", "MS", "RC", "RI", "CC"],
        configurationBasis: `${variant}-DESIGN-BL-2026-06-30`,
        limitations: [
          "Final commodity flow and selected as-built equipment positions remain under controlled confirmation.",
        ],
      },
    ),
  ];
  mef.analysisBasis.scopeRecords = [
    record(
      variant,
      "O-SCOPE-001",
      "Integrated Other Hazards analysis boundary",
      "Defines included plant locations, hazard groups, operating states, units, radioactive-material sources, and risk metrics for the quantitative analysis.",
      "The boundary follows the HSA routing register and full-scope PRA configuration snapshot without limiting the analysis to at-power operation.",
      {
        hazardGroupRefs: hazards.map((hazard) => id(variant, `HG-${hazard.code}`)),
        includedPlantLocations: [
          "Protected area",
          "Power block",
          "Operations and control building",
          "Heat-removal structures",
          "Emergency power yard",
          "Outdoor operator routes",
        ],
        excludedPlantLocations: [
          "Offsite administrative warehouse with no modeled safety, source, support, or operator-action role",
        ],
        includedOperatingStateRefs: pos,
        includedReactorUnitRefs: units,
        includedRadioactiveMaterialSourceRefs: sources,
        riskMetrics: ["sequence-family frequency/plant-year", "release-category frequency/plant-year"],
        intendedCapabilityCategory: "CC-II",
      },
    ),
  ];
  mef.analysisBasis.baselinePra = {
    modelName: `${variant} Full-Scope Internal Events Model`,
    modelReference: `${variant}-PRA-MODEL-2026-06`,
    revision: "R6",
    freezeDate: "2026-06-30",
    freezeStatus: "FROZEN",
    modelBoundary: `All ${units.length} units/modules, shared systems, spent-fuel or fuel-storage source, and ${pos.length} representative operating states.`,
    plantOperatingStateRefs: pos,
    reactorUnitRefs: units,
    radioactiveMaterialSourceRefs: sources,
    recordTreatments: [
      "PLANT_OPERATING_STATES",
      "INITIATING_EVENTS",
      "EVENT_SEQUENCES",
      "SUCCESS_CRITERIA",
      "SYSTEMS",
      "DATA",
      "HUMAN_RELIABILITY",
      "LEVEL_2",
      "RISK_INTEGRATION",
    ].map((area, index) =>
      record(
        variant,
        `O-BASE-${String(index + 1).padStart(2, "0")}`,
        `${area.replace(/_/g, " ")} baseline treatment`,
        "Records whether the frozen internal-events technical record is reused or modified for Other Hazards conditions.",
        "A discipline lead compared the source record against hazard-induced failure, timing, access, environment, and dependency needs.",
        {
          technicalArea: area as NonNullable<
            OtherHazardsPRA["analysisBasis"]["baselinePra"]
          >["recordTreatments"][number]["technicalArea"],
          sourceRecordRefs: [`${area}-BASE-R6`],
          treatment: index < 1 ? ("REUSED" as const) : ("MODIFIED" as const),
          otherHazardsChange:
            index < 1 ? "Scope is reused directly." : (
              "Hazard-specific failures, timing, environment, correlation, or output attributes are added."
            ),
          unresolvedItems: [],
        },
      ),
    ),
    unresolvedInterfaces: [],
  };

  mef.analysisBasis.evidenceRegister = [
    record(
      variant,
      "EVID-STD",
      "ASME/ANS RA-S-1.4-2021 non-LWR PRA standard",
      "Controls the applicable OHA, OFR, and OPR supporting requirements and capability expectations.",
      "The project conformance matrix maps each applicable supporting requirement to analysis records and evidence.",
      {
        evidenceType: "STANDARD",
        sourceReference: "ASME/ANS RA-S-1.4-2021",
        revision: "2021",
        effectiveDate: "2021-12-01",
        applicableSubelements: ["OHA", "OFR", "OPR"],
        hazardGroupRefs: [],
        applicability: "Primary technical standard for the analysis.",
        qualityAndLimitations:
          "Controlled licensed copy; interpretations are recorded in the project basis memorandum.",
        fileReference: "REF-STD-O-001",
        controlled: true,
      },
    ),
    record(
      variant,
      "EVID-SITE",
      "Site and surroundings characterization package",
      "Compiles current geography, land use, industrial inventories, transportation, air traffic, regional natural-hazard data, and site reconnaissance results.",
      "The package reconciles public datasets to the 2026 site survey and plant coordinate system.",
      {
        evidenceType: "SITE_DATA",
        sourceReference: `${variant}-SITE-CHAR-2026`,
        revision: "R2",
        effectiveDate: "2026-06-30",
        applicableSubelements: ["OHA", "OFR", "OPR"],
        hazardGroupRefs: [],
        applicability: "Site-specific source, distance, population, and environment basis.",
        qualityAndLimitations:
          "Offsite inventories verified through agency records and owner interviews; change monitoring is annual.",
        fileReference: "SITE-CHAR/O",
        controlled: true,
      },
    ),
    record(
      variant,
      "EVID-DESIGN",
      "Other Hazards design and configuration index",
      "Controls general arrangements, HVAC diagrams, structural details, equipment locations, protection features, procedures, and qualification records.",
      "Configuration management confirms each source document is current to the model freeze.",
      {
        evidenceType: "DRAWING",
        sourceReference: `${variant}-O-DESIGN-INDEX`,
        revision: "R4",
        effectiveDate: "2026-06-30",
        applicableSubelements: ["OFR", "OPR"],
        hazardGroupRefs: [],
        applicability: "Plant-specific SSC, location, barrier, system, and operator-action basis.",
        qualityAndLimitations:
          "Selected as-built confirmation is carried as explicit pre-operational assumptions.",
        fileReference: "DESIGN/O/INDEX",
        controlled: true,
      },
    ),
    record(
      variant,
      "EVID-CALC",
      "Integrated Other Hazards calculation package",
      "Controls source models, hazard curves, fragility calculations, response quantification, uncertainty propagation, and verification records.",
      "Independent calculations, automated tests, input manifests, and reviewer signoffs establish reproducibility.",
      {
        evidenceType: "CALCULATION",
        sourceReference: `${variant}-CALC-O-001`,
        revision: "R1",
        effectiveDate: "2026-08-10",
        applicableSubelements: ["OHA", "OFR", "OPR"],
        hazardGroupRefs: [],
        applicability: "Quantitative model and result basis.",
        qualityAndLimitations: "Software and random seeds are configuration controlled.",
        fileReference: "CALC/O/001",
        controlled: true,
      },
    ),
    record(
      variant,
      "EVID-INV",
      "Multidiscipline Other Hazards walkdown and tabletop",
      "Records field confirmation of exposed SSCs, protection features, toxic isolation, access routes, hazard sources, and credited human actions.",
      "The investigation plan sampled every active SSC and every credited action under representative hazard conditions.",
      {
        evidenceType: "INVESTIGATION",
        sourceReference: `${variant}-INV-O-2026-05`,
        revision: "Final",
        effectiveDate: "2026-05-22",
        applicableSubelements: ["OFR", "OPR"],
        hazardGroupRefs: [],
        applicability: "As-designed/as-intended confirmation pending final as-built closeout.",
        qualityAndLimitations: "Open construction items are identified in the pre-operational register.",
        fileReference: "INV/O/2026",
        controlled: true,
      },
    ),
  ];
  mef.analysisBasis.siteAndRegionalData = hazards.flatMap((hazard, index) => [
    record(
      variant,
      `O-DATA-${hazard.code}-01`,
      `${hazard.name} occurrence dataset`,
      `Qualifies source population, event history, intensity, location, and exposure data for ${hazard.name.toLowerCase()}.`,
      "The dataset is current, spatially representative, and adjusted for completeness and reporting changes.",
      {
        dataType:
          index === 0 ? "INDUSTRIAL_ACTIVITY"
          : index === 1 ?
            htgr ? "AIR_TRAFFIC"
            : "PLANT_CONFIGURATION"
          : htgr ? "GEOLOGY"
          : "METEOROLOGY",
        sourceReference: `${variant}-${hazard.code}-DATA-2026`,
        spatialCoverage:
          index === 1 && !htgr ?
            "Turbine building and missile-relevant protected-area sectors"
          : "Site and source-specific influence region",
        periodStart: "1980-01-01",
        periodEnd: "2025-12-31",
        resolution: "Event-level with annual exposure and source-location attributes",
        completeness: 0.96 - index * 0.02,
        applicability: `Direct input to the ${hazard.name} occurrence and severity model.`,
        limitations: ["Rare-tail uncertainty is propagated by the hazard logic tree."],
      },
    ),
    record(
      variant,
      `O-DATA-${hazard.code}-02`,
      `${hazard.name} environmental and spatial dataset`,
      `Defines environmental conditions and source-to-site geometry governing ${hazard.name.toLowerCase()} effects.`,
      "Site coordinates, terrain, structures, meteorology, and source geometry are reconciled in the plant coordinate system.",
      {
        dataType: index === 0 ? "METEOROLOGY" : "TOPOGRAPHY",
        sourceReference: `${variant}-${hazard.code}-SPATIAL-2026`,
        spatialCoverage: "Source-to-site domain and all affected plant locations",
        periodStart: "1991-01-01",
        periodEnd: "2025-12-31",
        resolution:
          index === 0 ?
            "Hourly meteorology and 10 m spatial receptor grid"
          : "1 m site geometry with regional source zones",
        completeness: 0.98,
        applicability: "Source-to-site and location-intensity calculation.",
        limitations: ["Sub-grid building wake effects are represented by a model-form uncertainty branch."],
      },
    ),
  ]);
  mef.analysisBasis.designBasisRecords = [
    record(
      variant,
      "O-DES-001",
      "Control-room and emergency ventilation design basis",
      "Defines intake locations, isolation logic, detector setpoints, filter capacity, leakage, power, and mission time used for toxic and smoke scenarios.",
      "Current HVAC drawings, control logic, qualification records, and habitability calculations are configuration controlled.",
      {
        informationType: "CALCULATION",
        sourceReference: `${variant}-HAB-001`,
        revision: "R5",
        affectedLocations: ["Main control room", "Emergency response facility", "Remote shutdown panel"],
        affectedSscRefs: [`${variant}-SSC-01`, `${variant}-SSC-02`],
        currentConfigurationConfirmed: true,
        confirmationRef: id(variant, "O-CONF-001"),
      },
    ),
    record(
      variant,
      "O-DES-002",
      "Hazard barrier and equipment-location basis",
      "Defines structural barriers, missile paths, roof loads, equipment anchorage, intake protection, and safety-system separation.",
      "General arrangements and design calculations are reconciled to the investigation photographic record.",
      {
        informationType: "DRAWING",
        sourceReference: `${variant}-GA-HAZ-INDEX`,
        revision: "R7",
        affectedLocations: [
          "Power block",
          "Control building",
          "Heat-removal structures",
          "Emergency power yard",
        ],
        affectedSscRefs: [`${variant}-SSC-03`, `${variant}-SSC-04`],
        currentConfigurationConfirmed: true,
        confirmationRef: id(variant, "O-CONF-002"),
      },
    ),
  ];
  mef.analysisBasis.operatingExperience = hazards.map((hazard, index) =>
    record(
      variant,
      `O-OE-${hazard.code}`,
      `${hazard.name} operating experience`,
      `Applies a documented industry event involving ${hazard.name.toLowerCase()} to source modeling, SSC vulnerability, operator response, or recovery.`,
      "The team screened domestic and international nuclear and relevant industrial experience for physical and operational similarity.",
      {
        eventDate: ["2005-01-06", "1983-02-25", "2010-04-14"][index]!,
        facilityOrIndustry:
          index === 0 ? "Graniteville chlorine release and nuclear toxic-gas experience"
          : index === 1 ? "Nuclear/industrial impact and rotating-equipment experience"
          : "Nuclear and thermal-generation ash/smoke experience",
        hazardDescription: hazard.mechanism,
        hazardEffects: hazard.effects,
        affectedFunctions: ["Control and monitoring", "Decay heat removal", "Protected operator response"],
        lessonsApplied: [
          "Treat delayed detection and access explicitly",
          "Control common environmental exposure",
          "Require configuration-confirmed protection features",
        ],
        applicability: `Event mechanisms and response lessons are applicable to ${plantName}; plant-specific frequencies and layouts are used.`,
      },
    ),
  );

  mef.analysisBasis.interfaces = INTERFACES.map((spec) => {
    const transferItems = interfaceTransferRows(variant, spec.code).map((row, itemIndex) => ({
      uuid: id(variant, `IF-${spec.code}-${itemIndex + 1}`),
      name: row.name,
      recordRef: row.recordRef,
      sourceModelRef: row.sourceModelRef,
      destinationRefs: row.destinationRefs,
      values: row.values,
      evidenceRefs: [id(variant, "EVID-STD"), id(variant, "EVID-CALC"), id(variant, "EVID-DESIGN")],
      status: "CONTROLLED" as const,
    }));
    return record(
      variant,
      `O-IF-${spec.code}`,
      `${spec.code} ${spec.name} interface`,
      `Controls ${spec.role} between ${spec.name} and the Other Hazards PRA.`,
      "Producer and consumer leads reconciled record identity, units, revisions, destinations, and consistency checks at the model freeze.",
      {
        technicalElementCode: spec.code,
        technicalElementName: spec.name,
        direction: spec.direction,
        role: spec.role,
        producer: spec.direction === "INPUT" ? spec.code : "O",
        consumer: spec.direction === "INPUT" ? "O" : spec.code,
        payloadType: spec.payload,
        columns: spec.columns,
        transferItems,
        producerRefs: transferItems.map((item) => item.recordRef),
        consumerRefs: transferItems.flatMap((item) => item.destinationRefs),
        consistencyChecks: [
          "Record identifiers and revisions reconcile",
          "Units and definitions agree",
          "Every transfer has an accepted destination",
          "Origin tags prevent double counting",
        ],
        consistent: true,
        openItems: [],
      },
    );
  });

  mef.retainedHazardGroups.hazardGroups = hazards.map((hazard) =>
    record(
      variant,
      `O-HG-${hazard.code}`,
      hazard.name,
      `Retains ${hazard.name.toLowerCase()} as a complete quantitative Other Hazards group and defines the applicable subhazards, effects, intensity parameter, plant scope, and analysis boundary.`,
      "HSA retained the group because conservative screening did not demonstrate negligible event-sequence-family risk; specialized-PRA overlaps are controlled explicitly.",
      {
        hazardCategory: hazard.category,
        hazardName: hazard.name,
        includedSubhazards: hazard.subhazards,
        excludedSubhazards: [],
        sourceHsaRefs: [`HS-${variant}-${hazard.code}`],
        retainedBasis:
          "Retained by the controlled HSA final-disposition register for detailed quantitative evaluation.",
        analysisBoundary: `Source occurrence through source-to-site effects, SSC/functional fragility, plant response, HRA, sequence quantification, and risk integration for ${hazard.name}.`,
        primaryEffects: hazard.effects,
        candidateIntensityMeasures: [
          hazard.intensity,
          "Source release or event magnitude",
          "Location-specific demand",
        ],
        selectedIntensityMeasure: hazard.intensity,
        intensityUnit: hazard.unit,
        plantOperatingStateRefs: pos,
        reactorUnitRefs: units,
        radioactiveMaterialSourceRefs: sources,
        analysisStatus: "COMPLETE",
      },
    ),
  );
  mef.retainedHazardGroups.completenessReviews = hazards.map((hazard) =>
    record(
      variant,
      `O-COMP-${hazard.code}`,
      `${hazard.name} completeness review`,
      `Confirms that the hazard group covers every credible subgroup, source, primary effect, secondary effect, operating state, unit, and radioactive-material source.`,
      "A structured comparison against the HSA inventory, site characterization, industry taxonomies, and specialized-PRA boundaries found no uncontrolled omission.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        reviewedSubhazards: hazard.subhazards,
        screeningBoundary:
          "All site-relevant sources and effects within the HSA influence region and plant-controlled area.",
        omittedPhenomena: [],
        omissionBasis:
          "No credible subgroup is omitted; impossible or specialized effects remain traceably dispositioned.",
        complete: true,
      },
    ),
  );
  mef.retainedHazardGroups.overlapControls = hazards.map((hazard) =>
    record(
      variant,
      `O-OVR-${hazard.code}`,
      `${hazard.name} overlap control`,
      `Assigns primary and secondary phenomena to Other Hazards and specialized PRA elements without omission or duplicate frequency.`,
      "A single origin tag follows each causal event through all transferred secondary analyses and risk integration.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        potentiallyOverlappingElementCodes: ["F", "FL", "XF", "S", "W", "IE"],
        overlapDescription: `${hazard.name} can create initiators or secondary effects modeled by other technical elements.`,
        retainedInOtherHazards: [
          "Origin frequency",
          "primary effects",
          "causal dependencies",
          "integrated scenario result",
        ],
        transferredOut: ["Specialized fire/flood phenomenology where applicable"],
        doubleCountingControl: `ORIGIN-O-${hazard.code} retained on all dependent records and excluded from independent-origin totals.`,
        confirmed: true,
      },
    ),
  );

  const hazardGroups = mef.retainedHazardGroups.hazardGroups;
  mef.hazardSourceCharacterization.hazardSources = hazards.map((hazard) =>
    record(
      variant,
      `O-SRC-${hazard.code}`,
      `${hazard.name} controlling source`,
      `Characterizes the controlling source population, location, inventory, state, generation mechanism, and affected plant locations for ${hazard.name.toLowerCase()}.`,
      "Site-specific source surveys and current regional datasets provide the central estimate; source-population uncertainty is retained.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        sourceType: hazard.sourceType,
        sourceLocation: hazard.source,
        distanceToPlantKilometres: hazard.distance,
        sourceInventory: hazard.inventory,
        sourceDimensions: "Source-specific geometry represented in the controlled source model",
        operatingOrOccurrenceState: "Normal source population with credible accident or natural-event state",
        releaseOrGenerationMechanism: hazard.mechanism,
        affectedPlantLocations: [hazard.location, "Outdoor access routes", "Shared site support areas"],
        sourceDataRefs: [id(variant, `O-DATA-${hazard.code}-01`), id(variant, `O-DATA-${hazard.code}-02`)],
      },
    ),
  );
  mef.hazardSourceCharacterization.intensityMeasures = hazards.map((hazard) =>
    record(
      variant,
      `O-IM-${hazard.code}`,
      `${hazard.name} controlled intensity measure`,
      `Defines ${hazard.intensity.toLowerCase()} as the common hazard, fragility, scenario, and response parameter for ${hazard.name.toLowerCase()}.`,
      "The parameter preserves the governing physical challenge at the plant and can be calculated consistently from source severity through conditional failure.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        parameterName: hazard.intensity,
        unit: hazard.unit,
        physicalMeaning: `Location-specific ${hazard.intensity.toLowerCase()} experienced by exposed SSCs or operators.`,
        sourceToSiteTransformation: `Controlled ${hazard.code} source-to-site model maps source state and environment to plant demand.`,
        plantResponseRelevance:
          "Intervals distinguish equipment failure, habitability, access, initiating-event, and recovery conditions.",
        fragilityCompatibility:
          "Demand and capacity models use the same unit and location definition; conversions are explicit and verified.",
        selected: true,
      },
    ),
  );
  mef.hazardSourceCharacterization.effectModels = hazards.map((hazard) =>
    record(
      variant,
      `O-EFF-${hazard.code}`,
      `${hazard.name} source-to-site effect model`,
      `Calculates ${hazard.effects.map((effect) => effect.toLowerCase().replace(/_/g, " ")).join(", ")} at affected plant locations from the controlling source and environment.`,
      "The selected model is benchmarked against observations, validated code use, hand checks, or published experiments appropriate to the phenomenon.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        sourceRefs: [id(variant, `O-SRC-${hazard.code}`)],
        hazardEffects: hazard.effects,
        modelName: `${hazard.code}-SOURCE-TO-SITE-1.0`,
        modelDescription: hazard.mechanism,
        inputParameters: [
          "Source severity",
          "Source location and geometry",
          "Environmental state",
          "Shielding and attenuation",
          "Plant receptor coordinates",
        ],
        outputParameters: [hazard.intensity, "Arrival time", "Duration", "Location multipliers"],
        affectedLocations: [hazard.location, "Outdoor action routes"],
        verificationAndValidation:
          "Independent input review, limiting-case hand calculations, benchmark comparison, and regression tests completed.",
        limitations: [
          "Rare source and environmental combinations are represented through epistemic branches.",
        ],
      },
    ),
  );
  mef.hazardSourceCharacterization.spatialZones = hazards.map((hazard, index) =>
    record(
      variant,
      `O-ZONE-${hazard.code}`,
      `${hazard.name} plant exposure zone`,
      `Maps the source-to-site intensity field, affected rooms and outdoor areas, credited attenuation, and exposed SSCs for ${hazard.name.toLowerCase()}.`,
      "The zone follows plant coordinates and model resolution; boundaries conservatively envelop gradients important to plant response.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        zoneType:
          index === 0 ? "PLUME_ZONE"
          : index === 1 ? "IMPACT_ZONE"
          : "BLOCKAGE_ZONE",
        boundaryDescription: `All areas where ${hazard.intensity.toLowerCase()} exceeds the first modeled interval threshold.`,
        plantLocations: [hazard.location, "Protected-area outdoor routes", "Shared site support facilities"],
        sscRefs: [`${variant}-SSC-${String(index + 1).padStart(2, "0")}`],
        intensityVariation:
          "Location multiplier field retained by building, elevation, and intake or target orientation.",
        shieldingOrAttenuation:
          "No favorable shielding credited unless supported by configuration-confirmed geometry and sensitivity analysis.",
      },
    ),
  );
  mef.hazardSourceCharacterization.timelineModels = hazards.map((hazard, index) =>
    record(
      variant,
      `O-TIME-${hazard.code}`,
      `${hazard.name} warning and duration model`,
      `Defines warning, onset, rise, duration, recovery environment, cues, and temporal dependencies used by scenario and human-reliability models.`,
      "Timeline values combine source physics, detection or forecast performance, operating experience, and conservative action-window definitions.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        onsetType:
          index === 0 ? "SUDDEN"
          : index === 1 ? "SUDDEN"
          : "FORECASTABLE",
        warningTimeHours: [0.25, 0.02, 12][index]!,
        riseTimeHours: [0.2, 0.001, 4][index]!,
        durationHours: [6, 0.1, 72][index]!,
        recoveryEnvironmentHours: [12, 24, 120][index]!,
        keyCues: ["External agency notification", "Plant detector or alarm", "Visual or process indications"],
        temporalDependencies: [
          "Detection before isolation",
          "Hazard duration before unprotected recovery",
          "Concurrent site demands",
        ],
      },
    ),
  );

  mef.hazardFrequencyAnalysis.occurrenceDataSets = hazards.map((hazard, index) =>
    record(
      variant,
      `O-FDATA-${hazard.code}`,
      `${hazard.name} frequency dataset`,
      `Qualifies event counts, exposure, completeness, spatial coverage, bias corrections, and accepted uses for ${hazard.name.toLowerCase()}.`,
      "The data period and region balance site relevance with enough exposure to support rare-event extrapolation.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        dataSourceType: index === 1 ? "HISTORICAL" : "REGIONAL",
        sourceReference: `${variant}-${hazard.code}-FREQ-DB-2026`,
        spatialCoverage:
          "Source-specific site influence region with national or industry exposure used for rare-event support",
        periodStart: "1980-01-01",
        periodEnd: "2025-12-31",
        eventCount: [47, 126, 33][index]!,
        observationYears: [410, 1250, 690][index]!,
        completeness: 0.95,
        biasCorrections: [
          "Reporting-practice change",
          "Source-population exposure",
          "Spatial representativeness",
          "Event independence",
        ],
        acceptedUses: ["Occurrence rate", "Severity distribution", "Uncertainty bounds"],
      },
    ),
  );
  mef.hazardFrequencyAnalysis.occurrenceModels = hazards.map((hazard, index) =>
    record(
      variant,
      `O-FMOD-${hazard.code}`,
      `${hazard.name} occurrence and severity model`,
      `Estimates annual source occurrence, severity, spatial exposure, and the tail of ${hazard.intensity.toLowerCase()} at the plant.`,
      "The model form follows data support and physics; alternative plausible forms are retained in the logic tree.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        dataSetRefs: [id(variant, `O-FDATA-${hazard.code}`)],
        modelType:
          index === 0 ? "FAULT_TREE"
          : index === 1 ? "POISSON"
          : "EXTREME_VALUE",
        intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
        occurrenceRatePerYear: hazard.frequencies[0],
        severityDistribution:
          "Piecewise empirical body with generalized-Pareto or mechanistic rare-tail extrapolation",
        spatialOccurrenceModel:
          "Source-location distribution combined with plant target, direction, and attenuation geometry",
        temporalModel:
          "Stationary base case with nonstationary sensitivity where climate or source population warrants",
        fittingOrCalibrationMethod: "Maximum likelihood or Bayesian calibration with exposure normalization",
        goodnessOfFit:
          "Probability plots, likelihood comparison, posterior predictive checks, and withheld-event benchmarks acceptable",
        extrapolationTreatment:
          "Upper tail is extended until added sequence risk is below the convergence criterion.",
      },
    ),
  );
  mef.hazardFrequencyAnalysis.regionalApplicabilityAssessments = hazards.map((hazard) =>
    record(
      variant,
      `O-APP-${hazard.code}`,
      `${hazard.name} regional-data applicability`,
      `Compares source-region and site attributes and documents adjustments and conservatism for non-site data used by the frequency model.`,
      "The comparison covers source population, environment, construction, reporting, exposure, and physical transport attributes material to the result.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        dataSetRef: id(variant, `O-FDATA-${hazard.code}`),
        comparisonAttributes: [
          "Source population",
          "Event severity",
          "Meteorology or direction",
          "Distance",
          "Reporting completeness",
        ],
        siteValues: [
          hazard.inventory,
          `${hazard.distance} km source distance`,
          "Plant-specific environmental distribution",
        ],
        sourceRegionValues: [
          "Normalized regional exposure",
          "Range spans the site attributes",
          "Regional environmental distribution",
        ],
        differences: [
          "Site exposure and target geometry applied explicitly",
          "Residual model-form difference retained as uncertainty",
        ],
        adjustmentMethod: "Exposure normalization and plant-specific source-to-site transformation",
        conservatismAssessment: "95th-percentile branch bounds plausible unfavorable differences.",
        applicable: true,
      },
    ),
  );
  mef.hazardFrequencyAnalysis.expertJudgmentPanels = [
    record(
      variant,
      "O-EJ-001",
      "Cross-hazard rare-tail expert panel",
      "Elicits only the poorly observed rare-tail and source-to-site model quantities material to the CC-II result.",
      "The process follows a documented formal protocol with independent estimates, calibration questions, equal access to evidence, and performance-informed aggregation.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazards[1]!.code}`),
        elicitationQuestion:
          "What is the conditional annual exceedance frequency beyond the largest observed intensity after accounting for source exposure and plant geometry?",
        experts: [
          "Independent hazard statistician",
          "Phenomenology specialist",
          "Industry operating-experience specialist",
          "Plant design specialist",
        ],
        independenceControls: [
          "Separate initial judgments",
          "Conflict-of-interest declarations",
          "Facilitated challenge without forced consensus",
        ],
        briefingMaterials: [
          "Controlled data package",
          "Model alternatives",
          "Calibration questions",
          "Plant geometry",
        ],
        elicitedQuantities: [
          "Tail-shape parameter",
          "Upper-bound occurrence rate",
          "Source-to-site model bias",
        ],
        aggregationMethod: "Performance-weighted log-space mixture with equal-weight sensitivity",
        calibrationMethod: "Seed questions with known event frequencies and transport outcomes",
        results: ["Median, 5th, and 95th percentile distributions supplied to logic-tree branches"],
      },
    ),
  ];
  mef.hazardFrequencyAnalysis.frequencyResults = hazards.flatMap((hazard) =>
    hazard.values.map((intensity, index) =>
      record(
        variant,
        `O-FRES-${hazard.code}-${index + 1}`,
        `${hazard.name} exceedance at ${intensity} ${hazard.unit}`,
        `Records the mean and uncertainty percentile annual exceedance frequency at a controlled intensity and plant receptor.`,
        "The result integrates occurrence, severity, source-to-site transformation, logic-tree weights, and parameter uncertainty.",
        {
          hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
          occurrenceModelRef: id(variant, `O-FMOD-${hazard.code}`),
          intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
          intensityValue: intensity,
          intensityUnit: hazard.unit,
          meanAnnualExceedanceFrequency: hazard.frequencies[index]!,
          fifthPercentileFrequency: hazard.frequencies[index]! * 0.32,
          medianFrequency: hazard.frequencies[index]! * 0.82,
          ninetyFifthPercentileFrequency: hazard.frequencies[index]! * 2.9,
          location: hazard.location,
        },
      ),
    ),
  );

  mef.secondaryAndCombinedHazards.secondaryHazardScenarios = hazards.map((hazard, index) =>
    record(
      variant,
      `O-SEC-${hazard.code}`,
      `${hazard.name} consequential ${
        index === 0 ? "toxic environment"
        : index === 1 ? "fire"
        : "loss of support"
      }`,
      `Defines a credible secondary challenge generated by ${hazard.name.toLowerCase()} and preserves its conditional probability, timing, affected locations, SSCs, and destination model.`,
      "Mechanistic analysis and operating experience establish the generation mechanism and the specialized-model handoff where required.",
      {
        primaryHazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        secondaryHazardType:
          index === 1 ? "INTERNAL_FIRE"
          : index === 2 ? "LOSS_OF_OFFSITE_POWER"
          : "TOXIC_ENVIRONMENT",
        generationMechanism:
          index === 1 ? "Impact or hot fragments ignite exposed combustibles and challenge nearby cables."
          : index === 2 ? "Environmental loading or deposition degrades grid and site support functions."
          : "The primary release creates an unprotected habitability and access challenge.",
        conditionalOccurrenceProbability: [0.92, 0.14, 0.28][index]!,
        affectedLocations: [hazard.location, "Outdoor access routes"],
        affectedSscRefs: [`${variant}-SSC-${String(index + 1).padStart(2, "0")}`],
        temporalRelationship:
          "Secondary effect begins after the primary source event and remains causally linked by the same origin tag.",
        analysisElementCode: index === 1 ? "F" : "O",
        transferredRecordRefs: index === 1 ? [`F-${variant}-O-ORIGIN-${hazard.code}`] : [],
      },
    ),
  );
  mef.secondaryAndCombinedHazards.combinedHazardAssessments = hazards.map((hazard, index) =>
    record(
      variant,
      `O-COMB-${hazard.code}`,
      `${hazard.name} combined-condition assessment`,
      `Evaluates causal, coincident, sequential, and common-condition hazards that can change source frequency, plant demand, response, or recovery.`,
      "Dependence is retained where physically supported; independent coincident events use explicit mission-time convolution.",
      {
        primaryHazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        combinedHazards:
          index === 0 ? ["Adverse wind direction", "loss of offsite power"]
          : index === 1 ? ["secondary fire", "loss of offsite power"]
          : ["extreme temperature", "grid disturbance"],
        relationship: index === 1 ? "CAUSALLY_RELATED" : "COMMON_CONDITION",
        jointFrequencyMethod:
          "Conditional hazard model for common conditions; time-window convolution for independent coincidences",
        dependencyTreatment:
          "Shared source, environmental, equipment, and recovery dependencies retained in scenario and system logic.",
        combinedEffects: hazard.effects,
        plantResponseTreatment:
          "Combined effects alter initiating events, SSC fragility, HRA context, mission time, and recovery as applicable.",
        doubleCountingControl: `Single ORIGIN-O-${hazard.code} tag follows the combined scenario into risk integration.`,
      },
    ),
  );
  mef.secondaryAndCombinedHazards.transferredAnalyses = [
    record(
      variant,
      "O-TRANS-F-001",
      "Other Hazards induced-fire transfer",
      "Transfers impact- or equipment-failure-induced fire source, location, timing, targets, and origin controls to Internal Fire PRA.",
      "The Fire PRA lead accepted the transferred source and returned the specialized scenario result before model freeze.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazards[1]!.code}`),
        destinationElementCode: "F",
        transferredScenarioRefs: [id(variant, `O-SEC-${hazards[1]!.code}`)],
        transferContent: [
          "Ignition source and energy",
          "Location and timing",
          "Damage targets",
          "Origin tag",
        ],
        receivingRecordRefs: [`F-${variant}-O-ORIGIN-${hazards[1]!.code}`],
        acceptanceStatus: "CLOSED",
        overlapControl:
          "Fire frequency is conditional on the Other Hazards origin and excluded from independent fire ignition totals.",
      },
    ),
  ];
  mef.secondaryAndCombinedHazards.dependencyControls = hazards.map((hazard) =>
    simple(
      variant,
      `O-DEP-${hazard.code}`,
      `${hazard.name} causal-dependency control`,
      `Maintains shared source, environment, timing, damage, operator, and recovery dependencies across primary and secondary model records.`,
      [id(variant, `O-HG-${hazard.code}`), id(variant, `O-SEC-${hazard.code}`)],
    ),
  );

  mef.hazardCurveAnalysis.logicTreeBranches = hazards.flatMap((hazard) => [
    record(
      variant,
      `O-LT-${hazard.code}-A`,
      `${hazard.name} central-model branch`,
      "Represents the best-supported occurrence, severity, and source-to-site model combination.",
      "Central data treatment and validated model choices receive the largest weight.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        branchType: "OCCURRENCE_MODEL",
        branchChoice: "Central occurrence and source-to-site model",
        branchWeight: 0.65,
        rationale: "Best statistical fit and strongest physical validation.",
      },
    ),
    record(
      variant,
      `O-LT-${hazard.code}-B`,
      `${hazard.name} conservative alternative branch`,
      "Represents a plausible higher-frequency or slower-attenuation alternative used for epistemic uncertainty.",
      "The alternative bounds data completeness, tail form, and source-to-site model bias.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        branchType: "EFFECT_MODEL",
        branchChoice: "Upper frequency and adverse source-to-site treatment",
        branchWeight: 0.35,
        rationale: "Plausible adverse alternative supported by model comparison and expert review.",
      },
    ),
  ]);
  mef.hazardCurveAnalysis.hazardCurves = hazards.map((hazard) =>
    record(
      variant,
      `O-CURVE-${hazard.code}`,
      `${hazard.name} mean hazard curve`,
      `Provides the mean annual exceedance frequency versus ${hazard.intensity.toLowerCase()} at the controlling plant receptor with uncertainty percentiles.`,
      "Logic-tree and parameter samples integrate qualified occurrence, severity, source-to-site, and model-form evidence.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
        intensityUnit: hazard.unit,
        location: hazard.location,
        logicTreeBranchRefs: [id(variant, `O-LT-${hazard.code}-A`), id(variant, `O-LT-${hazard.code}-B`)],
        curvePoints: hazard.values.map((intensity, index) => ({
          intensity,
          meanAnnualExceedanceFrequency: hazard.frequencies[index]!,
          fifthPercentileFrequency: hazard.frequencies[index]! * 0.32,
          medianFrequency: hazard.frequencies[index]! * 0.82,
          ninetyFifthPercentileFrequency: hazard.frequencies[index]! * 2.9,
        })),
        representsMeanCurve: true,
        uncertaintyFamilyAvailable: true,
        lowerAnalysisLimit: hazard.values[0],
        upperAnalysisLimit: hazard.values[3],
        extrapolationBasis:
          "Tail extended until added integrated risk is below one percent and no contributor-rank change occurs.",
      },
    ),
  );
  mef.hazardCurveAnalysis.hazardIntervals = hazards.flatMap((hazard) =>
    [0, 1, 2].map((index) =>
      record(
        variant,
        `O-INT-${hazard.code}-${index + 1}`,
        `${hazard.name} interval ${index + 1}`,
        `Discretizes the mean hazard curve into a nonoverlapping intensity range for conditional fragility and plant-response quantification.`,
        "Representative intensity preserves conditional risk within the bin and upper-tail contribution is tested for convergence.",
        {
          hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
          hazardCurveRef: id(variant, `O-CURVE-${hazard.code}`),
          lowerIntensity: hazard.values[index]!,
          upperIntensity: hazard.values[index + 1]!,
          representativeIntensity: Math.sqrt(hazard.values[index]! * hazard.values[index + 1]!),
          intervalAnnualFrequency: hazard.frequencies[index]! - hazard.frequencies[index + 1]!,
          conditionalWeight: 1,
          upperTail: index === 2,
        },
      ),
    ),
  );
  mef.hazardCurveAnalysis.convergenceStudies = hazards.map((hazard) =>
    record(
      variant,
      `O-HCONV-${hazard.code}`,
      `${hazard.name} interval and upper-tail convergence`,
      "Demonstrates stable sequence-family frequency as hazard intervals are refined and the upper analysis limit is extended.",
      "The maximum relative change is compared with the controlled five-percent acceptance criterion and contributor ranks are checked.",
      {
        studyType: "HAZARD_INTERVALS",
        hazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        testedValues: ["3 intervals", "6 intervals", "12 intervals", "upper limit × 1.5"],
        resultValues: ["reference", "+3.8%", "+1.4%", "+0.6%"],
        maximumRelativeDifference: 0.038,
        acceptanceCriterion: 0.05,
        converged: true,
      },
    ),
  );

  const investigationId = id(variant, "O-INV-001");
  const sscNames =
    htgr ?
      [
        "Control-room outside-air isolation train",
        "Emergency habitability filtration train",
        "Reactor cavity cooling air inlet",
        "Reactor-building roof and confinement boundary",
      ]
    : [
        "Control-room outside-air isolation train",
        "Protected emergency switchgear ventilation",
        "Decay-heat air-dump heat-exchanger inlet",
        "Turbine-building missile barrier",
      ];
  mef.preliminaryPlantResponse.preliminaryInitiatingEvents = hazards.map((hazard, index) =>
    record(
      variant,
      `O-PIE-${hazard.code}`,
      `${hazard.name} hazard-induced initiator`,
      `Defines the direct or degraded plant condition caused by ${hazard.name.toLowerCase()} and its affected scope and safety functions.`,
      "The initiating-event definition is mutually exclusive with the independent internal-events group and retains causal secondary effects.",
      {
        hazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        eventType:
          index === 0 ? "DEGRADED_CONDITION"
          : index === 1 ? "DIRECT"
          : "COMMON_CAUSE",
        initiatingEventRef: `IE-O-${hazard.code}`,
        affectedOperatingStateRefs: pos,
        affectedUnitRefs: units,
        affectedRadioactiveMaterialSourceRefs: sources,
        affectedSafetyFunctions: [
          "Reactivity control",
          "Decay heat removal",
          "Inventory confinement",
          "Control and monitoring",
        ],
        preliminaryFrequencyBasis: `Hazard-curve interval frequency with conditional initiating-event probability from ${hazard.code} source and effect models.`,
      },
    ),
  );
  mef.preliminaryPlantResponse.modelReviews = [
    "SYSTEM_LOGIC",
    "EVENT_SEQUENCE",
    "SUCCESS_CRITERIA",
    "DATA",
    "HRA",
    "LEVEL_2",
    "PEER_REVIEW_FINDING",
  ].map((reviewType, index) =>
    record(
      variant,
      `O-MREV-${index + 1}`,
      `${reviewType.replace(/_/g, " ")} Other Hazards review`,
      "Compares the frozen baseline PRA technical record with hazard-specific failures, environment, timing, correlation, and output needs.",
      "The responsible technical lead dispositioned every difference and linked required changes to implementation and verification records.",
      {
        baselineModelRef: `${reviewType}-BASE-R6`,
        reviewType:
          reviewType as OtherHazardsPRA["preliminaryPlantResponse"]["modelReviews"][number]["reviewType"],
        sourceRecordRefs: [`${reviewType}-BASE-R6-REC`],
        otherHazardsGap:
          index === 6 ?
            "One applicable baseline peer-review observation required explicit common-environment correlation."
          : "Baseline model lacks the hazard-specific demand, failure, timing, or dependency attributes.",
        requiredChange:
          "Add Other Hazards initiator, conditional failure, environment, timing, and traceability attributes where applicable.",
        affectedSscRefs: [`${variant}-SSC-${String((index % sscNames.length) + 1).padStart(2, "0")}`],
        closureStatus: "INCORPORATED",
      },
    ),
  );
  mef.preliminaryPlantResponse.otherHazardsSscList = sscNames.map((sscName, index) => {
    const hazard = hazards[index % hazards.length]!;
    const sscUuid = id(variant, `O-SSC-${index + 1}`);
    const failureMode = record(
      variant,
      `O-FM-${index + 1}`,
      `${sscName} governing failure mode`,
      `Defines loss of the credited function from ${hazard.effects.map((effect) => effect.toLowerCase().replace(/_/g, " ")).join(" or ")} under the linked hazard demand.`,
      "Failure is defined consistently with system success criteria, physical capacity, operator support, and the hazard intensity parameter.",
      {
        failureModeType:
          index === 0 ? "OPERATOR_INCAPACITATION"
          : index === 1 ? "ENVIRONMENTAL_EXPOSURE"
          : index === 2 ? "BLOCKAGE"
          : "STRUCTURAL_FAILURE",
        hazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        hazardEffects: hazard.effects,
        creditedFunction: [
          "Control-room habitability",
          "Protected electrical support",
          "Decay heat removal",
          "Confinement and separation",
        ][index]!,
        failureDefinition: `Loss of ${sscName.toLowerCase()} for the required hazard mission.`,
        requiredState: index === 3 ? "BARRIER_INTEGRITY" : "FUNCTION_DURING_EVENT",
        supportingElementRefs: [`${variant}-SUPPORT-${index + 1}`],
        systemModelBasicEventRefs: [`BE-O-${variant}-${index + 1}`],
        eventSequenceRefs: [`ESF-O-${hazard.code}`],
        fragilityRefs: [id(variant, `O-FRAG-${index + 1}`)],
        consequenceDescription:
          "Can initiate or worsen the Other Hazards sequence and defeat a credited prevention or mitigation function.",
      },
    );
    return record(
      variant,
      `O-SSC-${index + 1}`,
      `${sscName} SSC-list entry`,
      `Retains ${sscName.toLowerCase()} because its hazard-induced failure can initiate an event or defeat credited control, cooling, confinement, monitoring, power, or operator response.`,
      "System logic, success criteria, design information, location review, and investigation findings support inclusion.",
      {
        sscRef: `${variant}-SSC-${String(index + 1).padStart(2, "0")}`,
        sscName,
        building:
          index < 2 ? "Operations and control building"
          : index === 2 ? "Heat-removal structure"
          : "Power block",
        roomOrArea: index < 2 ? `Habitability zone H-${index + 1}` : `Outdoor/structural zone ${index + 1}`,
        elevation: `${100 + index * 15} ft`,
        safetyFunctions: [
          ["Control and monitoring", "Operator habitability"],
          ["Protected electrical support"],
          ["Decay heat removal"],
          ["Confinement and separation"],
        ][index]!,
        applicableHazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        applicableHazardEffects: hazard.effects,
        failureModes: [failureMode],
        investigationRefs: [investigationId],
        disposition: "ACTIVE",
      },
    ) as OtherHazardsPRA["preliminaryPlantResponse"]["otherHazardsSscList"][number];
  });
  const sscs = mef.preliminaryPlantResponse.otherHazardsSscList;
  mef.preliminaryPlantResponse.functionalRequirements = sscs.map((ssc, index) =>
    record(
      variant,
      `O-FUNC-${index + 1}`,
      `${ssc.safetyFunctions[0]} hazard functional requirement`,
      `Defines the SSCs, supports, operator actions, operating states, and mission time required to achieve ${ssc.safetyFunctions[0]!.toLowerCase()} under the linked hazard.`,
      "Baseline success criteria are retained where valid and extended for hazard duration, access, environment, and recovery.",
      {
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        safetyFunction: ssc.safetyFunctions[0]!,
        requiredSscRefs: [ssc.uuid],
        supportingSscRefs: ssc.failureModes[0]!.supportingElementRefs,
        requiredOperatorActionRefs: [id(variant, `O-HA-${index + 1}`)],
        operatingStateRefs: pos,
        missionTimeHours: [12, 24, 72, 168][index]!,
      },
    ),
  );

  mef.plantInvestigation.investigations = [
    record(
      variant,
      "O-INV-001",
      "Multidiscipline Other Hazards plant investigation",
      "Confirms hazard sources, exposed SSCs, supports, protection features, spatial interactions, operator routes, procedures, and credited configuration for every retained hazard group.",
      "A preplanned walkdown and tabletop sampled every active SSC and credited action and reconciled observations with drawings and the model database.",
      {
        investigationType: "WALKDOWN",
        scope:
          "All active Other Hazards SSCs, source zones, protection features, access routes, local actions, and unresolved design assumptions",
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        plantOperatingStateRefs: pos,
        locations: [
          "Control and operations building",
          "Power block",
          "Heat-removal structures",
          "Emergency power yard",
          "Outdoor access routes",
        ],
        participants: [
          "Hazard analyst",
          "Fragility engineer",
          "Systems analyst",
          "HRA analyst",
          "Operations representative",
          "Configuration management",
        ],
        performedDate: "2026-05-22",
        observations: [
          "Intake and detector geometry confirmed",
          "Barrier and SSC locations reconciled",
          "Alternate action routes timed",
          "Temporary and outage conditions reviewed",
        ],
        findingRefs: [id(variant, "O-FIND-001"), id(variant, "O-FIND-002")],
        confirmedRecordRefs: sscs.map((item) => item.uuid),
      },
    ),
  ];
  mef.plantInvestigation.findings = [
    record(
      variant,
      "O-FIND-001",
      "Toxic detector response-test frequency confirmed",
      "Confirms installed detector locations, sample transport, alarm setpoint, response time, surveillance interval, and common-power dependencies.",
      "Field observation and procedure review support the modeled detection timeline and identify one as-built closeout item.",
      {
        investigationRef: investigationId,
        findingType: "PROTECTION_FEATURE",
        location: "Control-room outside-air intake",
        affectedSscRefs: [sscs[0]!.uuid],
        affectedHazardGroupRefs: [hazardGroups[0]!.uuid],
        condition:
          "Detector and isolation logic match design; final sample-line routing requires as-built confirmation.",
        modelImpact:
          "Base detection and isolation time retained; upper uncertainty branch covers final routing difference.",
        correctiveAction: "Confirm sample-line routing and repeat response-time test before fuel load.",
        closureStatus: "MODELED",
      },
    ),
    record(
      variant,
      "O-FIND-002",
      "Outdoor recovery route and protective-equipment finding",
      "Times the primary and alternate outdoor routes and verifies supplied-air, communication, lighting, and staffing needs.",
      "A talk-through under simulated impaired visibility established the action time and dependency conditions.",
      {
        investigationRef: investigationId,
        findingType: "ACCESS",
        location: "Operations building to emergency equipment yard",
        affectedSscRefs: sscs.slice(0, 3).map((item) => item.uuid),
        affectedHazardGroupRefs: hazardGroups.map((item) => item.uuid),
        condition: "Primary route is feasible with supplied-air equipment; alternate route adds six minutes.",
        modelImpact: "Hazard-context HEP and recovery timing use the measured route and PPE donning times.",
        correctiveAction:
          "Stage two supplied-air sets at the protected egress point and include the route in annual drills.",
        closureStatus: "CONFIRMED",
      },
    ),
  ];
  mef.plantInvestigation.configurationConfirmations = sscs.map((ssc, index) =>
    record(
      variant,
      `O-CONF-${index + 1}`,
      `${ssc.sscName} configuration confirmation`,
      `Confirms the design record, physical location, support, protection, route, and credited plant condition for ${ssc.sscName.toLowerCase()}.`,
      "Drawing-to-field reconciliation found no unmodeled discrepancy affecting the base result.",
      {
        sourceRecordRef: id(variant, index < 2 ? "O-DES-001" : "O-DES-002"),
        investigationRefs: [investigationId],
        plantConditionBasis: "AS_DESIGNED_AS_INTENDED",
        configurationItems: [
          ssc.sscRef,
          ssc.building,
          ssc.roomOrArea,
          ...ssc.failureModes[0]!.supportingElementRefs,
        ],
        discrepancies: [],
        resolution:
          "Configuration confirmed; final as-built status remains in the pre-operational closeout program where applicable.",
        confirmed: true,
      },
    ),
  );
  mef.plantInvestigation.accessRouteChecks = sscs.map((ssc, index) =>
    record(
      variant,
      `O-ROUTE-${index + 1}`,
      `${ssc.safetyFunctions[0]} operator route`,
      `Verifies the route, hazard exposure, protective equipment, travel time, communication, and alternate path supporting the credited operator action.`,
      "Walkdown and timed talk-through under simulated hazard conditions establish feasibility and timing margin.",
      {
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        humanActionRefs: [id(variant, `O-HA-${index + 1}`)],
        routeDescription:
          index < 2 ?
            "Protected control-room interior action"
          : "Protected egress to outdoor local equipment",
        routeSegments: [
          "Procedure and equipment pickup",
          "Primary route",
          "Local action station",
          "Return or protected hold point",
        ],
        hazardEffects: ssc.applicableHazardEffects,
        protectiveEquipment:
          index < 2 ?
            ["Portable radio"]
          : ["Supplied-air respirator", "Eye protection", "Portable radio", "High-visibility outerwear"],
        travelTimeMinutes: [2, 4, 14, 18][index]!,
        available: true,
        alternateRoute: index < 2 ? "Redundant interior access" : "North protected egress; adds six minutes",
      },
    ),
  );

  mef.fragilityBasis.methodSelections = sscs.map((ssc, index) =>
    record(
      variant,
      `O-METH-${index + 1}`,
      `${ssc.sscName} fragility method`,
      `Selects a plant-specific physical or functional failure method compatible with the governing hazard intensity measure.`,
      "Information quality, failure mechanism, risk significance, test or design data, and investigation evidence support the selected realistic CC-II treatment.",
      {
        sscRefs: [ssc.uuid],
        failureModeRefs: [ssc.failureModes[0]!.uuid],
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        methodType:
          index === 0 ? "HUMAN_RESPONSE_MODEL"
          : index === 1 ? "TEST_DATA"
          : "PLANT_SPECIFIC_ANALYSIS",
        intensityMeasureRef: id(variant, `O-IM-${hazards[index % hazards.length]!.code}`),
        capacityModel:
          "Lognormal capacity or empirically fitted functional-response model with separated aleatory and epistemic uncertainty",
        demandModel: "Location-specific intensity and duration from the controlled source-to-site model",
        selectedInformationRefs: [
          id(variant, "EVID-DESIGN"),
          id(variant, "EVID-INV"),
          id(variant, "EVID-CALC"),
        ],
        applicabilityJustification:
          "Plant geometry, component attributes, environment, and failure definition match the selected data and method.",
        capabilityTreatment: "REALISTIC_CC_II",
      },
    ),
  );
  mef.fragilityBasis.screeningDecisions = [
    record(
      variant,
      "O-FSCREEN-001",
      "Non-safety administration-building SSC screen",
      "Screens components with no initiating-event, mitigation, support, source, confinement, monitoring, access, or propagation role after configuration confirmation.",
      "Complete loss of screened components has no modeled event-sequence-family effect and remains below the aggregate screening criterion.",
      {
        screenedObjectType: "SSC",
        screenedObjectRefs: [`${variant}-ADMIN-NONPRA-SSC`],
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        hazardEffects: hazards.flatMap((item) => item.effects),
        criterion: "SCR-2",
        disposition: "SCREENED",
        conservativeAssumptions: ["Complete loss of screened components", "No recovery credit"],
        quantitativeValue: 1.6e-9,
        quantitativeUnit: "event-sequence-family frequency/plant-year",
        threshold: 1e-7,
        aggregateFrequencyPerPlantYear: 1.6e-9,
        investigationRefs: [investigationId],
        affectedEventSequenceFamilyRefs: [],
      },
    ),
  ];
  mef.fragilityBasis.correlationGroups = [
    record(
      variant,
      "O-CORR-001",
      "Common hazard demand and protection correlation",
      "Groups SSCs sharing the same environmental field, building boundary, detector/isolation logic, construction population, or source condition.",
      "Common demand is fully correlated within each scenario; conditional capacity correlation is retained where construction or protection is shared.",
      {
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        memberSscRefs: sscs.map((item) => item.uuid),
        commonDemandSources: ["Shared plant intensity field", "Common source and environmental realization"],
        commonCapacitySources: [
          "Common design and construction program",
          "Shared ventilation isolation logic",
        ],
        correlationType: "PARTIAL",
        correlationCoefficient: 0.55,
        modelTreatment:
          "Gaussian-copula capacity sampling conditional on the common hazard realization; causal protection failures modeled explicitly.",
      },
    ),
  ];
  mef.fragilityBasis.genericDataApplicability = sscs.map((ssc, index) =>
    record(
      variant,
      `O-GEN-${index + 1}`,
      `${ssc.sscName} generic-data applicability`,
      `Compares the target SSC and environment with generic test, experience, design, or fragility information used in the capacity model.`,
      "Function, materials, geometry, demand rate, environment, qualification, aging, and failure definition are compared explicitly.",
      {
        genericSourceRef: `GEN-O-${index + 1}`,
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        targetSscRefs: [ssc.uuid],
        comparedAttributes: [
          "Function and failure definition",
          "Materials and geometry",
          "Demand rate and duration",
          "Environmental qualification",
          "Aging and condition",
        ],
        differences: [
          "Plant-specific geometry and support incorporated",
          "Generic dispersion retained only as prior information",
        ],
        adjustmentFactors: [
          "Median adjusted to plant-specific calculation",
          "Epistemic beta increased for residual difference",
        ],
        conservatismAssessment:
          "Adjusted model is realistic for CC-II and its 95th percentile bounds the unresolved difference.",
        applicable: true,
      },
    ),
  );

  mef.fragilityAnalysis.demandModels = sscs.map((ssc, index) => {
    const hazard = hazards[index % hazards.length]!;
    return record(
      variant,
      `O-DEMAND-${index + 1}`,
      `${ssc.sscName} hazard demand model`,
      `Calculates location-, duration-, and scenario-specific demand on ${ssc.sscName.toLowerCase()} from the controlled ${hazard.name.toLowerCase()} intensity.`,
      "The model preserves the hazard-curve intensity definition and applies only verified spatial, shielding, dynamic, or temporal transformations.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        sscRefs: [ssc.uuid],
        failureModeRefs: [ssc.failureModes[0]!.uuid],
        intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
        demandQuantity: hazard.intensity,
        demandUnit: hazard.unit,
        modelEquationOrCode: `${hazard.code}-DEMAND-MODEL-1.0`,
        inputParameters: [
          "Hazard intensity",
          "Location multiplier",
          "Duration",
          "Protection state",
          "Environmental condition",
        ],
        spatialFactors: [
          "Building/elevation receptor",
          "Intake or target orientation",
          "No unsupported shielding",
        ],
        dynamicOrTemporalFactors: [
          "Rise and duration",
          "Detection/isolation timing",
          "Load-rate or deposition history",
        ],
        outputRange: `${hazard.values[0]}–${hazard.values[3]} ${hazard.unit}`,
        verificationRefs: [id(variant, "EVID-CALC")],
      },
    );
  });
  mef.fragilityAnalysis.capacityModels = sscs.map((ssc, index) => {
    const hazard = hazards[index % hazards.length]!;
    return record(
      variant,
      `O-CAP-${index + 1}`,
      `${ssc.sscName} capacity model`,
      `Establishes median capacity and separated randomness and uncertainty for the governing functional failure mode.`,
      "Plant calculations, qualification or response tests, generic evidence, aging, condition, and investigation findings are combined without double counting uncertainty.",
      {
        sscRef: ssc.uuid,
        failureModeRef: ssc.failureModes[0]!.uuid,
        capacityQuantity: hazard.intensity,
        capacityUnit: hazard.unit,
        medianCapacity: hazard.values[2] * (0.8 + index * 0.12),
        randomnessBeta: 0.24 + index * 0.03,
        uncertaintyBeta: 0.31 + index * 0.025,
        informationSourceRefs: [id(variant, "EVID-DESIGN"), id(variant, "EVID-INV"), `GEN-O-${index + 1}`],
        agingAndConditionFactors: [
          "Reference service age",
          "Preventive maintenance",
          "Environmental qualification",
          "Observed condition",
        ],
        testOrExperienceBasis:
          "Plant-specific design or response test anchored by applicable generic data and operating experience.",
      },
    );
  });
  const fragilityPoints = (hazard: HazardSpec, index: number) =>
    [0, 1, 2, 3].map((pointIndex) => ({
      intensity: hazard.values[pointIndex]!,
      conditionalFailureProbability: [
        [0.003, 0.04, 0.36, 0.96],
        [0.002, 0.025, 0.28, 0.92],
        [0.005, 0.08, 0.48, 0.98],
        [0.001, 0.02, 0.22, 0.9],
      ][index]![pointIndex]!,
    }));
  mef.fragilityAnalysis.fragilityCurves = sscs.map((ssc, index) => {
    const hazard = hazards[index % hazards.length]!;
    const capacity = mef.fragilityAnalysis.capacityModels[index]!;
    return record(
      variant,
      `O-FRAG-${index + 1}`,
      `${ssc.sscName} conditional fragility`,
      `Quantifies conditional functional failure probability over the controlled ${hazard.intensity.toLowerCase()} range.`,
      "The curve integrates compatible demand and capacity, plant-specific evidence, aleatory variability, epistemic uncertainty, and correlation-group treatment.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        sscRef: ssc.uuid,
        failureModeRef: ssc.failureModes[0]!.uuid,
        methodSelectionRef: mef.fragilityBasis.methodSelections[index]!.uuid,
        demandModelRef: mef.fragilityAnalysis.demandModels[index]!.uuid,
        capacityModelRef: capacity.uuid,
        intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
        intensityUnit: hazard.unit,
        medianCapacityIntensity: capacity.medianCapacity,
        randomnessBeta: capacity.randomnessBeta,
        uncertaintyBeta: capacity.uncertaintyBeta,
        curvePoints: fragilityPoints(hazard, index),
        hazardSpecific: true,
        crossHazardUseJustification:
          "No cross-hazard use is credited; the curve is specific to the linked demand definition and failure mode.",
        correlationGroupRefs: [id(variant, "O-CORR-001")],
      },
    );
  });
  mef.fragilityAnalysis.functionalFailureModels = hazards.map((hazard, index) =>
    record(
      variant,
      `O-FFM-${hazard.code}`,
      `${hazard.name} operator and functional-failure model`,
      `Represents loss of access, habitability, cues, or operator capability that is not captured by a physical component fragility.`,
      "Published response limits, plant procedures, protective equipment, timed actions, and uncertainty are combined on the controlled intensity basis.",
      {
        hazardGroupRef: id(variant, `O-HG-${hazard.code}`),
        affectedFunction: ["Control-room response", "Local manual recovery", "Outdoor equipment inspection"][
          index
        ]!,
        physicalOrHumanMechanism:
          index === 0 ? "OPERATOR_INCAPACITATION"
          : index === 1 ? "LOSS_OF_ACCESS"
          : "LOSS_OF_CUE",
        intensityMeasureRef: id(variant, `O-IM-${hazard.code}`),
        probabilityModel: "Monotonic logistic response with uncertainty bounds and duration adjustment",
        probabilityPoints: hazard.values.map((intensity, pointIndex) => ({
          intensity,
          conditionalFailureProbability: [0.01, 0.08, 0.46, 0.97][pointIndex]!,
        })),
        destinationModelRefs: [sscs[index]!.uuid, id(variant, `O-HA-${index + 1}`)],
      },
    ),
  );
  mef.fragilityAnalysis.secondaryEffectFragilities = [
    record(
      variant,
      "O-SECF-001",
      "Induced-fire secondary fragility linkage",
      "Connects the hazard-induced fire scenario to affected SSC failure modes and accepted Internal Fire PRA conditional damage results.",
      "The conditional model preserves the Other Hazards origin and uses the specialized Fire PRA damage analysis.",
      {
        primaryHazardGroupRef: hazardGroups[1]!.uuid,
        secondaryHazardScenarioRef: id(variant, `O-SEC-${hazards[1]!.code}`),
        affectedSscRefs: sscs.slice(1, 4).map((item) => item.uuid),
        failureModeRefs: sscs.slice(1, 4).map((item) => item.failureModes[0]!.uuid),
        conditionalFailureModel:
          "Accepted Fire PRA scenario damage conditional on the Other Hazards initiating event",
        fragilityRefs: mef.fragilityAnalysis.fragilityCurves.slice(1, 4).map((item) => item.uuid),
      },
    ),
  ];

  mef.initiatingEventAndScenarioDevelopment.initiatingEventModels = hazards.map((hazard, index) =>
    record(
      variant,
      `O-IE-${hazard.code}`,
      `${hazard.name} initiating-event model`,
      `Defines the hazard-induced initiator, affected plant scope, frequency derivation, and causal secondary hazards for ${hazard.name.toLowerCase()}.`,
      "The event definition is complete, mutually exclusive with independent initiators, and consistent with hazard intervals and plant-response logic.",
      {
        hazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        sourceInitiatingEventRef: `IE-BASE-${index + 1}`,
        initiatingEventType:
          index === 0 ? "OPERATOR_INCAPACITATION"
          : index === 1 ? "STRUCTURAL_DAMAGE"
          : "SUPPORT_SYSTEM_LOSS",
        eventDefinition: `${hazard.name} exceeds the modeled plant-response threshold and creates a direct or degraded plant condition.`,
        affectedOperatingStateRefs: pos,
        affectedUnitRefs: units,
        affectedRadioactiveMaterialSourceRefs: sources,
        frequencyDerivation:
          "Hazard-interval frequency multiplied by the conditional initiator state where it is not unity.",
        secondaryHazardRefs: [id(variant, `O-SEC-${hazard.code}`)],
      },
    ),
  );
  mef.initiatingEventAndScenarioDevelopment.scenarioFamilies = hazards.map((hazard, index) =>
    record(
      variant,
      `O-SCEN-${hazard.code}`,
      `${hazard.name} plant-response scenario family`,
      `Groups source, location, interval, initiating event, SSC damage, secondary effects, operating state, unit, and material sources that share plant-response logic.`,
      "Conditional response remains similar within the group and sensitivity confirms grouping does not mask a risk-significant contributor.",
      {
        hazardGroupRefs: [id(variant, `O-HG-${hazard.code}`)],
        initiatingEventRefs: [id(variant, `O-IE-${hazard.code}`)],
        scenarioDefinition: `${hazard.name} challenges ${hazard.location}, fails or degrades the linked SSC/function, and requires protected operator response and recovery.`,
        sourceRefs: [id(variant, `O-SRC-${hazard.code}`)],
        spatialZoneRefs: [id(variant, `O-ZONE-${hazard.code}`)],
        affectedSscRefs: sscs
          .filter((_, sscIndex) => sscIndex % hazards.length === index)
          .map((item) => item.uuid),
        hazardIntervalRefs: [1, 2, 3].map((interval) => id(variant, `O-INT-${hazard.code}-${interval}`)),
        operatingStateRefs: pos,
        unitRefs: units,
        radioactiveMaterialSourceRefs: sources,
        secondaryHazardScenarioRefs: [id(variant, `O-SEC-${hazard.code}`)],
        groupingBasis:
          "Shared initiating event, plant damage pattern, action context, success criteria, and sequence logic.",
      },
    ),
  );
  mef.initiatingEventAndScenarioDevelopment.scenarioTimelines = hazards.map((hazard, index) =>
    record(
      variant,
      `O-STIME-${hazard.code}`,
      `${hazard.name} scenario timeline`,
      `Aligns warning, initiating event, equipment or functional failures, operator action windows, stable end state, and recovery.`,
      "Timeline values derive from the hazard model, equipment response, procedures, talk-throughs, and success-criteria mission analysis.",
      {
        scenarioFamilyRef: id(variant, `O-SCEN-${hazard.code}`),
        timeOrigin: "First credible plant warning or source occurrence",
        warningTimeHours: [0.25, 0.02, 12][index]!,
        initiatingEventTimeHours: [0.45, 0.021, 14][index]!,
        keyEquipmentFailureTimesHours: [0.5, 1.0 + index, 6 + index],
        operatorActionWindowsHours: [0.3 + index * 0.2, 2 + index, 8 + index * 4],
        stableEndStateTimeHours: [12, 24, 72][index]!,
        recoveryStartTimeHours: [8, 24, 96][index]!,
        timelineBasis:
          "Controlled hazard timeline, fragility response, system mission analysis, and confirmed action timing.",
      },
    ),
  );
  mef.initiatingEventAndScenarioDevelopment.secondaryScenarioLinks = hazards.map((hazard) =>
    simple(
      variant,
      `O-SLINK-${hazard.code}`,
      `${hazard.name} secondary-scenario linkage`,
      "Links the primary scenario family to its causal secondary-hazard record, receiving technical element, returned result, and plant-response destination.",
      [id(variant, `O-SCEN-${hazard.code}`), id(variant, `O-SEC-${hazard.code}`)],
    ),
  );
  mef.initiatingEventAndScenarioDevelopment.industryExperienceEvents =
    mef.analysisBasis.operatingExperience.map((experience, index) =>
      record(
        variant,
        `O-IND-${index + 1}`,
        `${hazards[index]!.name} scenario-model experience`,
        "Applies observed initiators, equipment failures, human-performance effects, and recovery lessons to the scenario and timeline model.",
        "The team compared physical mechanisms, plant configuration, staffing, procedures, and response conditions before application.",
        {
          eventDate: experience.eventDate,
          facility: experience.facilityOrIndustry,
          hazardGroupRefs: [hazardGroups[index]!.uuid],
          eventDescription: experience.hazardDescription,
          initiatingEvents: [
            mef.initiatingEventAndScenarioDevelopment.initiatingEventModels[index]!.eventDefinition,
          ],
          equipmentFailures: [sscs[index]!.failureModes[0]!.failureDefinition],
          humanPerformanceEffects: [
            "Alarm interpretation",
            "Protective-equipment delay",
            "Access and communication constraints",
          ],
          recoveryExperience: [
            "Source isolation",
            "Environmental monitoring",
            "Staged restoration after hazard clearance",
          ],
          modelApplications: [
            "Scenario timeline",
            "HRA context",
            "Recovery probability",
            "Uncertainty alternative",
          ],
        },
      ),
    );

  mef.plantResponseModel.peerReviewDispositions = ["IE", "ES", "SC", "SY", "HR", "DA", "MS", "RC"].map(
    (element, index) =>
      record(
        variant,
        `O-PEER-${index + 1}`,
        `${element} peer-review finding disposition`,
        "Determines whether an applicable baseline PRA finding can affect the Other Hazards plant-response model and records its evidence-backed closure.",
        "The responsible lead reviewed source finding text, resolution status, affected records, and hazard-specific model changes.",
        {
          sourcePraElement: element,
          findingId: `F&O-${element}-${17 + index}`,
          findingText:
            "Verify hazard-specific common-condition and timing treatment when the baseline record is reused.",
          relevanceToOtherHazards:
            "Applicable because the source record is reused or modified in an Other Hazards sequence.",
          disposition: "Hazard-specific dependency and timing treatment added and independently verified.",
          affectedModelRefs: [id(variant, `O-ES-${(index % hazards.length) + 1}`)],
          closureEvidenceRefs: [id(variant, "EVID-CALC")],
          closureStatus: "CLOSED",
        },
      ),
  );
  mef.plantResponseModel.missionTimes = hazards.map((hazard, index) =>
    record(
      variant,
      `O-MT-${index + 1}`,
      `${hazard.name} mission and recovery time`,
      `Defines the credited mission, stable end state, hazard-duration basis, and recovery treatment for the linked scenario family.`,
      "Thermal/process analysis, hazard duration, protected resource endurance, operating experience, and recovery access support the realistic CC-II mission.",
      {
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        eventSequenceRefs: [id(variant, `O-ES-${index + 1}`)],
        missionTimeHours: [12, 24, 168][index]!,
        stableEndState: [
          "Protected control and stable cooling",
          "Damage isolated and redundant cooling established",
          "Sustained decay heat removal with restored intake capacity",
        ][index]!,
        hazardDurationBasis: mef.hazardSourceCharacterization.timelineModels[index]!.description,
        recoveryModel:
          "Recovery begins only after environment, access, resources, and damage permit; no unsupported early recovery credit.",
        industryExperienceRefs: [
          mef.initiatingEventAndScenarioDevelopment.industryExperienceEvents[index]!.uuid,
        ],
        boundingOrRealistic: "REALISTIC",
      },
    ),
  );
  mef.plantResponseModel.eventSequenceModels = hazards.map((hazard, index) =>
    record(
      variant,
      `O-ES-${index + 1}`,
      `${hazard.name} event-sequence model`,
      `Adapts baseline event-tree logic to the hazard source, initiating event, SSC/functional failures, secondary effects, operator response, recovery, and Level 2 end states.`,
      "Functional events and success paths are consistent with verified systems, success criteria, HRA, mission time, and multi-unit dependencies.",
      {
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        scenarioFamilyRefs: [id(variant, `O-SCEN-${hazard.code}`)],
        initiatingEventRefs: [id(variant, `O-IE-${hazard.code}`)],
        sourceEventSequenceRef: `ES-BASE-${index + 1}`,
        eventSequenceFamilyRef: `ESF-O-${hazard.code}`,
        functionalEvents: [
          "Hazard detection/forecast",
          "Protection or isolation",
          "Required safety function",
          "Protected operator response",
          "Recovery",
        ],
        successPathDefinition:
          "Required function and habitability maintained until a stable end state or qualified recovery is achieved.",
        endStates: ["SUCCESS", `PDS-O-${index + 1}`, `RC-O-${index + 1}`],
        missionTimeRef: id(variant, `O-MT-${index + 1}`),
        unitRefs: units,
        radioactiveMaterialSourceRefs: sources,
        levelTwoPlantDamageStateRefs: [`PDS-O-${index + 1}`],
      },
    ),
  );
  mef.plantResponseModel.successCriteria = sscs.map((ssc, index) =>
    record(
      variant,
      `O-SC-${index + 1}`,
      `${ssc.safetyFunctions[0]} Other Hazards success criterion`,
      `Defines the equipment, capacity, timing, support, operator, and mission conditions required to achieve the credited safety function.`,
      "Baseline analysis is extended for the hazard environment and validated against applicable thermal, structural, habitability, or process calculations.",
      {
        sourceSuccessCriterionRef: `SC-BASE-${index + 1}`,
        eventSequenceRefs: [mef.plantResponseModel.eventSequenceModels[index % hazards.length]!.uuid],
        safetyFunction: ssc.safetyFunctions[0]!,
        criterion: `At least one protected and supported means of ${ssc.safetyFunctions[0]!.toLowerCase()} remains available for the full mission.`,
        hazardSpecificChanges:
          "Adds hazard exposure, protection state, environmental qualification, operator-access, and common-demand dependencies.",
        supportingAnalysisRefs: [id(variant, "EVID-CALC"), id(variant, "EVID-DESIGN")],
        missionTimeHours: [12, 24, 72, 168][index]!,
        validated: true,
      },
    ),
  );
  mef.plantResponseModel.systemModelModifications = sscs.map((ssc, index) =>
    record(
      variant,
      `O-SYSMOD-${index + 1}`,
      `${ssc.sscName} system-model modification`,
      `Adds hazard-induced basic events, fragility links, dependencies, correlations, and logic required to represent loss of ${ssc.sscName.toLowerCase()}.`,
      "Implementation was independently checked against the SSC list, failure mode, fragility, sequence, and source system model.",
      {
        sourceSystemModelRef: `SY-BASE-${index + 1}`,
        affectedBasicEventRefs: ssc.failureModes[0]!.systemModelBasicEventRefs,
        addedBasicEvents: [`BE-O-${variant}-${index + 1}`],
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        hazardFailureModeRefs: [ssc.failureModes[0]!.uuid],
        fragilityRefs: [id(variant, `O-FRAG-${index + 1}`)],
        correlationGroupRefs: [id(variant, "O-CORR-001")],
        logicChange:
          "Conditional hazard failure gate inserted ahead of the credited train/function with causal secondary and support dependencies.",
        verificationRefs: [`VERIFY-O-SY-${index + 1}`, id(variant, "EVID-CALC")],
      },
    ),
  );
  mef.plantResponseModel.dataParameters = hazards.map((hazard, index) =>
    record(
      variant,
      `O-DPAR-${index + 1}`,
      `${hazard.name} conditional response parameter`,
      `Controls a hazard-specific basic-event, recovery, common-cause, correlation, mission-time, or conditional probability used by plant response.`,
      "Point estimate and uncertainty distribution derive from plant data, operating experience, applicable generic data, and sensitivity review.",
      {
        parameterType:
          index === 0 ? "RECOVERY"
          : index === 1 ? "HAZARD_CONDITIONAL"
          : "CORRELATION",
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        destinationModelRefs: [mef.plantResponseModel.eventSequenceModels[index]!.uuid],
        pointEstimate: [0.18, 0.14, 0.55][index]!,
        distribution:
          index === 2 ? "Beta distribution on correlation surrogate" : "Lognormal with 5th/95th bounds",
        parameters: { mean: [0.18, 0.14, 0.55][index]!, errorFactor: [2.2, 2.8, 1.5][index]! },
        units: "probability",
        sourceDataRefs: [
          id(variant, "EVID-CALC"),
          mef.initiatingEventAndScenarioDevelopment.industryExperienceEvents[index]!.uuid,
        ],
      },
    ),
  );
  mef.plantResponseModel.correlationModels = [
    record(
      variant,
      "O-PCORR-001",
      "Other Hazards common-demand correlation model",
      "Implements conditional dependence among SSC failures exposed to the same hazard realization and shared protection or construction attributes.",
      "Common demand, shared capacity, and causal dependencies are separated to avoid both independence bias and double counting.",
      {
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        correlationGroupRef: id(variant, "O-CORR-001"),
        memberBasicEventRefs: sscs.flatMap((item) => item.failureModes[0]!.systemModelBasicEventRefs),
        commonDemandModel: "One sampled source and plant intensity field per scenario realization",
        commonCapacityModel:
          "Gaussian-copula capacities with group coefficient 0.55 and component-specific residuals",
        quantificationTreatment:
          "Conditional Monte Carlo within each hazard interval; causal protection failures represented explicitly.",
        sensitivityRefs: [id(variant, "O-SENS-002")],
      },
    ),
  ];
  mef.plantResponseModel.multiUnitAssessments = [
    record(
      variant,
      "O-MULTI-001",
      "Sitewide multi-unit and multi-source assessment",
      "Models common source exposure, shared SSCs, resources, actions, site conditions, and coupled recovery across all units/modules and radioactive-material sources.",
      "A site-level sequence treatment prevents multiplication of independent unit estimates when demand, staffing, or support is shared.",
      {
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        affectedUnitRefs: units,
        sharedSscRefs: sscs.slice(0, 2).map((item) => item.uuid),
        sharedResourceRefs: [
          "Shared control room",
          "Emergency response organization",
          "Portable supplied-air cache",
          "Site electrical support",
        ],
        sharedHumanActionRefs: [id(variant, "O-HA-1"), id(variant, "O-HA-4")],
        commonSiteConditions: [
          "One source-to-site intensity realization",
          "Concurrent access/habitability",
          "Shared staffing and recovery logistics",
        ],
        sequenceTreatment:
          "Site sequence branches identify affected units and sources conditional on the common demand realization.",
        dependencyTreatment:
          "Shared actions and resources use explicit high-dependency groups; independent unit equipment retains conditional independence where justified.",
      },
    ),
  ];
  mef.plantResponseModel.levelTwoInterfaces = hazards.map((hazard, index) =>
    record(
      variant,
      `O-L2-${index + 1}`,
      `${hazard.name} Level 2 interface`,
      "Transfers event-sequence, plant-damage, confinement, hazard-damage, release-category, and dependency attributes to Level 2 modeling.",
      "The Level 2 lead confirmed definitions, timing, scope, and dependent failures against the source sequence record.",
      {
        eventSequenceRefs: [mef.plantResponseModel.eventSequenceModels[index]!.uuid],
        plantDamageStateRefs: [`PDS-O-${index + 1}`],
        containmentOrConfinementStatus:
          index === 1 ?
            "Potential local barrier damage; modeled conditionally"
          : "Confinement intact unless linked SSC fragility fails",
        hazardDamageAttributes: [hazard.name, ...hazard.effects, "Recovery environment and duration"],
        releaseCategoryRefs: [`RC-O-${index + 1}`],
        dependentFailureTreatment:
          "Hazard-induced shared failures and recovery constraints retained in the plant-damage-state attributes.",
        acceptedByLevelTwo: true,
      },
    ),
  );

  mef.humanReliabilityAnalysis.humanActions = sscs.map((ssc, index) =>
    record(
      variant,
      `O-HA-${index + 1}`,
      `${ssc.safetyFunctions[0]} hazard response`,
      `Defines the credited preparation, diagnosis, response, or recovery action supporting ${ssc.safetyFunctions[0]!.toLowerCase()} under Other Hazards conditions.`,
      "Procedures, cues, staffing, equipment, access, timing, and hazard environment were confirmed in a multidisciplinary talk-through.",
      {
        sourceHumanActionRef: `HR-BASE-${index + 1}`,
        actionType:
          index === 0 ? "DIAGNOSIS"
          : index === 1 ? "REMOTE"
          : index === 2 ? "LOCAL_MANUAL"
          : "RECOVERY",
        hazardGroupRefs: ssc.applicableHazardGroupRefs,
        procedureRefs: [`AOP-O-${index + 1}`, "EOP-00"],
        cues: [
          "Hazard or external notification",
          "Plant detector/alarm",
          "System response indication",
          "Procedure entry condition",
        ],
        actionLocation: index < 2 ? "Main control room" : "Protected egress and local equipment area",
        destinationLocation: index < 2 ? undefined : ssc.roomOrArea,
        timeAvailableMinutes: [18, 35, 120, 360][index]!,
        executionTimeMinutes: [5, 8, 24, 42][index]!,
        requiredStaff:
          index < 2 ?
            ["Shift supervisor", "reactor operator"]
          : ["Auxiliary operator", "control-room communicator"],
        requiredEquipment:
          index < 2 ?
            ["Control panel", "procedure", "radio"]
          : ["Procedure", "radio", "supplied-air equipment", "portable detector"],
        credited: true,
      },
    ),
  );
  const actions = mef.humanReliabilityAnalysis.humanActions;
  mef.humanReliabilityAnalysis.humanFailureEvents = actions.map((action, index) =>
    record(
      variant,
      `O-HFE-${index + 1}`,
      `Failure to ${action.name.toLowerCase()}`,
      `Represents omission, delay, misdiagnosis, or unsuccessful execution of the credited action before its modeled deadline.`,
      "The event definition includes scenario, cues, crew, procedure, location, timing, failure outcome, and dependency treatment.",
      {
        humanActionRef: action.uuid,
        failureDefinition: `Crew fails to ${action.name.toLowerCase()} within ${action.timeAvailableMinutes} minutes or does not achieve the required functional state.`,
        modeledBasicEventRef: `HFE-O-${variant}-${String(index + 1).padStart(3, "0")}`,
        affectedEventSequenceRefs: [mef.plantResponseModel.eventSequenceModels[index % hazards.length]!.uuid],
        affectedSafetyFunctions: [sscs[index]!.safetyFunctions[0]!],
        dependencyGroupRefs: [id(variant, "O-HDEP-001")],
      },
    ),
  );
  const hfes = mef.humanReliabilityAnalysis.humanFailureEvents;
  mef.humanReliabilityAnalysis.performanceContexts = actions.map((action, index) =>
    record(
      variant,
      `O-PSF-${index + 1}`,
      `${action.name} performance context`,
      "Characterizes warning, environment, toxic or protective-equipment conditions, access, lighting, power, communication, workload, staffing, procedure quality, and multi-unit demands.",
      "The context is scenario-specific and confirmed by walkdown, interview, talk-through, and applicable operating experience.",
      {
        humanActionRef: action.uuid,
        hazardGroupRefs: action.hazardGroupRefs,
        warningAndCues:
          "External notification and plant alarms are available; ambiguous initial cues are represented in diagnosis HEP.",
        environmentalConditions:
          index === 0 ?
            "Potential unfiltered toxic/smoke ingress; protected control-room environment depends on isolation."
          : "Reduced visibility, noise, deposition or impact damage possible along the route.",
        toxicOrProtectiveEquipmentConditions:
          index < 2 ?
            "Protected interior; portable respirator available"
          : "Supplied-air respirator, eye protection, and portable detector required",
        accessAndTravel: mef.plantInvestigation.accessRouteChecks[index]!.routeDescription,
        lightingAndPower:
          "Normal lighting preferred; emergency lighting and portable lights available under LOOP",
        communications: "Hardwired controls, plant page, and portable radio with one verified repeater",
        workloadAndStaffing:
          index === 0 ?
            "High early diagnosis workload with concurrent unit alarms"
          : "Dedicated auxiliary operator with control-room communicator; sitewide demand included",
        procedureQuality:
          "Validated abnormal procedure with decision points, PPE, route, and hold-point criteria",
        multiUnitDemands: `Common hazard can affect ${units.length} units/modules; priority and shared staffing are modeled.`,
        available: true,
      },
    ),
  );
  const contexts = mef.humanReliabilityAnalysis.performanceContexts;
  mef.humanReliabilityAnalysis.hepEstimates = hfes.map((hfe, index) =>
    record(
      variant,
      `O-HEP-${index + 1}`,
      `${hfe.name} HEP estimate`,
      "Quantifies nominal and hazard-context failure probability with timing, dependency, recovery, uncertainty, and method basis.",
      "A recognized HRA method is applied using the confirmed performance context and timed action evidence.",
      {
        humanFailureEventRef: hfe.uuid,
        performanceContextRef: contexts[index]!.uuid,
        method:
          index < 2 ?
            "SPAR-H plus timing and scenario-specific PSF assessment"
          : "Cause-based decision tree with timed walkdown evidence",
        nominalHep: [0.03, 0.02, 0.06, 0.08][index]!,
        otherHazardsHep: [0.12, 0.07, 0.18, 0.22][index]!,
        lowerBound: [0.035, 0.02, 0.055, 0.07][index]!,
        upperBound: [0.38, 0.25, 0.52, 0.61][index]!,
        dependencyAdjustment: index === 3 ? 1.8 : 1.25,
        recoveryCredit: index < 2 ? 0.1 : 0,
        uncertaintyDistribution: "Lognormal HEP distribution truncated to [0,1] with elicited error factor",
      },
    ),
  );
  mef.humanReliabilityAnalysis.confirmations = [
    record(
      variant,
      "O-HCONF-001",
      "Other Hazards credited-action tabletop and talk-through",
      "Confirms procedure interpretation, cues, staffing, protective equipment, timing, access, communication, feasibility, and multi-unit priorities for every credited action.",
      "Licensed operators, auxiliary operators, HRA analysts, systems staff, and emergency-planning staff completed structured scenarios and field talk-throughs.",
      {
        humanActionRefs: actions.map((item) => item.uuid),
        confirmationType: "TABLETOP",
        participantRoles: [
          "Shift supervisor",
          "reactor operator",
          "auxiliary operator",
          "HRA analyst",
          "systems analyst",
          "emergency preparedness",
        ],
        confirmedProcedureInterpretation: true,
        confirmedTiming: true,
        confirmedFeasibility: true,
        findings: [
          "PPE staging added to procedure",
          "Alternate outdoor route requires six additional minutes",
          "Multi-unit prioritization clarified",
        ],
        modelChanges: ["Updated action time", "Raised hazard-context HEP", "Added shared-crew dependency"],
      },
    ),
  ];
  mef.humanReliabilityAnalysis.recoveryAssessments = actions.map((action, index) =>
    record(
      variant,
      `O-REC-${index + 1}`,
      `${action.name} recovery assessment`,
      "Reevaluates the baseline recovery model under hazard damage, access, environment, resources, timing, and multi-unit conditions.",
      "Only physically feasible, procedurally supported, and resource-available recovery after the limiting hazard condition receives credit.",
      {
        humanActionRef: action.uuid,
        sourceRecoveryModelRef: `HR-REC-BASE-${index + 1}`,
        hazardGroupRefs: action.hazardGroupRefs,
        damageConstraints: ["Linked SSC and support damage", "Protection state", "Secondary effects"],
        accessConstraints: [contexts[index]!.accessAndTravel, contexts[index]!.environmentalConditions],
        resourceConstraints: [
          "Shared crews",
          "Protective equipment",
          "Spare filters or components",
          "Site access",
        ],
        earliestRecoveryTimeHours: [8, 12, 48, 96][index]!,
        recoveryProbability: [0.18, 0.25, 0.12, 0.08][index]!,
        remainsValidUnderOtherHazards: index < 2,
      },
    ),
  );
  mef.humanReliabilityAnalysis.dependencyAssessments = [
    record(
      variant,
      "O-HDEP-001",
      "Sitewide Other Hazards HRA dependency",
      "Models shared crews, cues, locations, timing, hazard conditions, and resources among diagnosis, response, and recovery HFEs.",
      "Dependency level follows temporal order, cognitive coupling, team overlap, common environmental demand, and common success/failure cues.",
      {
        humanFailureEventRefs: hfes.map((item) => item.uuid),
        sharedCrews: ["Shift supervisor", "reactor operators", "auxiliary operators"],
        sharedCues: ["Common external notification", "sitewide alarms", "shared environmental monitor"],
        sharedLocations: ["Main control room", "protected egress", "emergency equipment yard"],
        temporalRelationship:
          "Early diagnosis influences subsequent response; local recoveries may be concurrent and resource-limited.",
        hazardConditionRelationship:
          "All actions experience the same source event and site environmental realization.",
        dependencyLevel: "HIGH",
        jointFailureProbability: 0.29,
      },
    ),
  ];

  const run = record(
    variant,
    "O-QRUN-001",
    "Integrated Other Hazards quantification run",
    "Integrates hazard intervals, fragilities, plant response, HRA, correlations, secondary hazards, uncertainty, and sequence-family logic for the controlled model.",
    "Input manifests, exact high-probability treatment, numerical convergence, independent verification, and reproducible software settings support the run.",
    {
      modelVersion: `${variant}-O-MODEL-1.0`,
      hazardGroupRefs: hazardGroups.map((item) => item.uuid),
      hazardCurveRefs: mef.hazardCurveAnalysis.hazardCurves.map((item) => item.uuid),
      hazardIntervalRefs: mef.hazardCurveAnalysis.hazardIntervals.map((item) => item.uuid),
      fragilityRefs: mef.fragilityAnalysis.fragilityCurves.map((item) => item.uuid),
      eventSequenceRefs: mef.plantResponseModel.eventSequenceModels.map((item) => item.uuid),
      humanFailureEventRefs: hfes.map((item) => item.uuid),
      successStateTreatment:
        "Success branches are retained to preserve normalization and high conditional failure probability; complementary states are exact.",
      rareEventApproximationTreatment:
        "Rare-event approximation used only for verified low-probability independent cutsets; exact Boolean probability used otherwise.",
      highFailureProbabilityTreatment:
        "Conditional probabilities are bounded and exact mutually exclusive/dependent logic prevents sums above unity.",
      truncationLimit: 1e-13,
      uncertaintySampleCount: 25_000,
      randomSeedReference: `${variant}-O-PCG64-20260814`,
      softwareAndVersion: "OpenPRA Quantifier 1.5.0",
      runDate: "2026-08-12",
    },
  );
  mef.eventSequenceQuantification.quantificationRuns = [run];
  const intervalResults = mef.hazardCurveAnalysis.hazardIntervals.map((interval, index) => {
    const hazardIndex = Math.floor(index / 3);
    const conditional = [0.0018, 0.012, 0.085][index % 3]! * (1 + hazardIndex * 0.2);
    return record(
      variant,
      `O-IRES-${index + 1}`,
      `${hazards[hazardIndex]!.name} interval ${(index % 3) + 1} sequence result`,
      "Calculates conditional sequence-family probability and annual frequency for one hazard interval with dominant fragility and basic-event contributors.",
      "The result comes from the controlled integrated run and preserves correlation, HRA, secondary, success-state, and exact high-probability treatment.",
      {
        quantificationRunRef: run.uuid,
        hazardGroupRef: hazardGroups[hazardIndex]!.uuid,
        hazardIntervalRef: interval.uuid,
        eventSequenceFamilyRef: `ESF-O-${hazards[hazardIndex]!.code}`,
        conditionalSequenceProbability: conditional,
        intervalAnnualFrequency: interval.intervalAnnualFrequency,
        sequenceFrequencyPerPlantYear: conditional * interval.intervalAnnualFrequency,
        dominantFragilityRefs: [mef.fragilityAnalysis.fragilityCurves[hazardIndex]!.uuid],
        dominantBasicEventRefs: [
          hfes[hazardIndex]!.modeledBasicEventRef,
          `BE-O-${variant}-${hazardIndex + 1}`,
        ],
      },
    );
  });
  mef.eventSequenceQuantification.hazardIntervalResults = intervalResults;
  mef.eventSequenceQuantification.eventSequenceFamilyResults = hazards.map((hazard, index) => {
    const point = intervalResults
      .filter((item) => item.hazardGroupRef === hazardGroups[index]!.uuid)
      .reduce((sum, item) => sum + item.sequenceFrequencyPerPlantYear, 0);
    return record(
      variant,
      `O-FAMRES-${hazard.code}`,
      `${hazard.name} event-sequence-family result`,
      "Aggregates interval results by hazard group, sequence family, operating state, unit, material source, plant-damage state, and release category.",
      "Monte Carlo samples propagate hazard, fragility, correlation, plant-response, and HRA uncertainty into mean and percentile frequencies.",
      {
        quantificationRunRef: run.uuid,
        eventSequenceFamilyRef: `ESF-O-${hazard.code}`,
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        operatingStateRefs: pos,
        unitRefs: units,
        radioactiveMaterialSourceRefs: sources,
        plantDamageStateRefs: [`PDS-O-${index + 1}`],
        releaseCategoryRefs: [`RC-O-${index + 1}`],
        pointEstimateFrequencyPerPlantYear: point * 0.9,
        meanFrequencyPerPlantYear: point,
        fifthPercentileFrequencyPerPlantYear: point * 0.24,
        medianFrequencyPerPlantYear: point * 0.79,
        ninetyFifthPercentileFrequencyPerPlantYear: point * 3.6,
      },
    );
  });
  const aggregate = mef.eventSequenceQuantification.eventSequenceFamilyResults.reduce(
    (sum, item) => sum + item.meanFrequencyPerPlantYear,
    0,
  );
  mef.eventSequenceQuantification.convergenceStudies = [
    record(
      variant,
      "O-QCONV-001",
      "Quantification sampling and truncation convergence",
      "Demonstrates stable aggregate and sequence-family frequencies under increasing sample count and decreasing cutset truncation.",
      "The largest relative change is below the controlled five-percent criterion and contributor ranks remain stable.",
      {
        studyType: "SAMPLING",
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        testedValues: [
          "5,000 samples",
          "10,000 samples",
          "25,000 samples",
          "50,000 samples; 1E-14 truncation",
        ],
        resultValues: ["+4.2%", "+2.1%", "reference", "+0.7%"],
        maximumRelativeDifference: 0.042,
        acceptanceCriterion: 0.05,
        converged: true,
      },
    ),
    record(
      variant,
      "O-QCONV-002",
      "Scenario grouping and upper-tail convergence",
      "Tests finer scenario grouping and extended upper hazard tails for missed risk contributors or material frequency change.",
      "No new risk-significant contributor appears and the maximum family-frequency change remains below ten percent.",
      {
        studyType: "SCENARIO_GROUPING",
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        testedValues: [
          "Base grouping",
          "Split by unit",
          "Split by wind/environment state",
          "Upper tail × 1.5",
        ],
        resultValues: ["reference", "+1.6%", "+2.8%", "+0.9%"],
        maximumRelativeDifference: 0.028,
        acceptanceCriterion: 0.05,
        converged: true,
      },
    ),
  ];
  mef.eventSequenceQuantification.uncertaintyResults = [
    record(
      variant,
      "O-URES-001",
      "Aggregate Other Hazards release-category uncertainty",
      "Propagates hazard, fragility, plant-response, HRA, correlation, secondary, and numerical uncertainty into the aggregate plant-year result.",
      "Paired epistemic/aleatory sampling preserves dependencies and reports stable mean and percentile estimates.",
      {
        quantificationRunRef: run.uuid,
        riskMetric: "Aggregate Other Hazards release-category frequency",
        meanValue: aggregate,
        fifthPercentile: aggregate * 0.23,
        median: aggregate * 0.78,
        ninetyFifthPercentile: aggregate * 3.7,
        units: "per plant-year",
        propagatedUncertaintyRefs: hazards.map((hazard) => id(variant, `O-U-HZ-${hazard.code}`)),
      },
    ),
  ];
  mef.eventSequenceQuantification.riskContributors =
    mef.eventSequenceQuantification.eventSequenceFamilyResults.flatMap((family, index) => [
      record(
        variant,
        `O-RC-HG-${index + 1}`,
        `${hazards[index]!.name} hazard-group contribution`,
        "Ranks the retained hazard group by absolute and fractional contribution to the aggregate Other Hazards result.",
        "Contribution is calculated from the same controlled run and reconciles to the aggregate within numerical tolerance.",
        {
          quantificationRunRef: run.uuid,
          contributorType: "HAZARD_GROUP",
          contributorRef: hazardGroups[index]!.uuid,
          riskMetric: "Aggregate Other Hazards release-category frequency",
          absoluteContribution: family.meanFrequencyPerPlantYear,
          fractionalContribution: family.meanFrequencyPerPlantYear / aggregate,
          rank: index + 1,
        },
      ),
      record(
        variant,
        `O-RC-SSC-${index + 1}`,
        `${sscs[index]!.sscName} SSC contribution`,
        "Ranks the dominant SSC vulnerability within the linked hazard scenario family.",
        "Conditional importance measures and interval-frequency weighting establish the contribution.",
        {
          quantificationRunRef: run.uuid,
          contributorType: "SSC",
          contributorRef: sscs[index]!.uuid,
          riskMetric: "Aggregate Other Hazards release-category frequency",
          absoluteContribution: family.meanFrequencyPerPlantYear * 0.46,
          fractionalContribution: (family.meanFrequencyPerPlantYear * 0.46) / aggregate,
          rank: hazards.length + index + 1,
        },
      ),
    ]);
  mef.eventSequenceQuantification.screeningDecisions = [
    record(
      variant,
      "O-QSCREEN-001",
      "Aggregate negligible sequence-family screen",
      "Screens a set of fully developed, low-frequency non-release sequence families after conservative aggregation.",
      "Upper-bound hazard, failure, HRA, and consequence treatment remains below the approved aggregate criterion.",
      {
        screenedObjectType: "EVENT_SEQUENCE_FAMILY",
        screenedObjectRefs: ["ESF-O-NONRELEASE-1", "ESF-O-NONRELEASE-2"],
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        hazardEffects: hazards.flatMap((item) => item.effects),
        criterion: "SCR-1",
        disposition: "SCREENED",
        conservativeAssumptions: ["95th-percentile hazard", "upper fragility", "no recovery credit"],
        quantitativeValue: 2.7e-9,
        quantitativeUnit: "per plant-year",
        threshold: 1e-7,
        aggregateFrequencyPerPlantYear: 2.7e-9,
        investigationRefs: [investigationId],
        affectedEventSequenceFamilyRefs: ["ESF-O-NONRELEASE-1", "ESF-O-NONRELEASE-2"],
      },
    ),
  ];

  mef.integratedUncertainties = hazards.map((hazard, index) =>
    record(
      variant,
      `O-U-HZ-${hazard.code}`,
      `${hazard.name} integrated model uncertainty`,
      `Captures the material occurrence, source-to-site, fragility, response, HRA, and correlation alternatives that can change the ${hazard.name.toLowerCase()} result.`,
      "Alternatives are represented directly in logic-tree, parameter, or sensitivity calculations and interpreted against decision thresholds.",
      {
        sourceSubelement:
          index === 0 ? "OHA"
          : index === 1 ? "OFR"
          : "OPR",
        uncertaintyType: "MODEL",
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        affectedRecordRefs: [
          id(variant, `O-CURVE-${hazard.code}`),
          id(variant, `O-FRAG-${index + 1}`),
          id(variant, `O-ES-${index + 1}`),
        ],
        potentialImpact:
          "Can change interval weight, dominant failure mode, family frequency, contributor rank, or improvement priority.",
        reasonableAlternatives: [
          "Higher occurrence tail",
          "Adverse source-to-site attenuation",
          "Higher capacity correlation",
          "Delayed detection or recovery",
        ],
        treatment:
          "Propagated in the integrated uncertainty sample and tested in focused sensitivity studies.",
        sensitivityStudyRefs: [id(variant, `O-SENS-${index + 1}`)],
        importance: index === 0 ? "HIGH" : "MEDIUM",
      },
    ),
  );
  mef.riskInterpretation.sensitivityStudies = hazards.map((hazard, index) => {
    const base = mef.eventSequenceQuantification.eventSequenceFamilyResults[index]!.meanFrequencyPerPlantYear;
    return record(
      variant,
      `O-SENS-${index + 1}`,
      `${hazard.name} reasonable-alternative sensitivity`,
      "Quantifies a plausible alternative that can change the hazard, fragility, HRA, correlation, recovery, or numerical treatment for the scenario family.",
      "The alternative is selected from the integrated uncertainty register and run on the same controlled model baseline.",
      {
        studyType:
          index === 0 ? "HRA"
          : index === 1 ? "FRAGILITY"
          : "HAZARD_MODEL",
        baseCaseRef: run.uuid,
        variedInputs: [
          index === 0 ? "Detector and isolation response time"
          : index === 1 ? "Median impact capacity and capacity correlation"
          : "Rare-tail occurrence and environmental duration",
        ],
        alternateValues: [
          index === 0 ? "Response time doubled"
          : index === 1 ? "Median capacity −20%; correlation 0.8"
          : "95th-percentile hazard tail and 2× duration",
        ],
        riskMetric: `ESF-O-${hazard.code} frequency`,
        baseResult: base,
        alternateResult: base * [1.38, 1.72, 1.44][index]!,
        relativeChange: [0.38, 0.72, 0.44][index]!,
        conclusion:
          index === 0 ? "Detector response testing and surveillance are risk-informed priorities."
          : index === 1 ? "Barrier capacity verification is warranted before baseline release."
          : "Source monitoring and filter-loading margin preserve defense in depth.",
      },
    );
  });
  mef.riskInterpretation.riskInsights = hazards.map((hazard, index) =>
    record(
      variant,
      `O-INS-${index + 1}`,
      `${hazard.name} risk insight`,
      `Interprets the dominant scenario, SSC vulnerability, human action, dependency, uncertainty, defense-in-depth feature, and risk-reduction opportunity for ${hazard.name.toLowerCase()}.`,
      "Contributor and sensitivity results are reconciled with physical plant response and uncertainty before drawing the decision implication.",
      {
        insightType:
          index === 0 ? "HUMAN_ACTION"
          : index === 1 ? "SSC_VULNERABILITY"
          : "DEFENSE_IN_DEPTH",
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        contributorRefs: [id(variant, `O-RC-HG-${index + 1}`), id(variant, `O-RC-SSC-${index + 1}`)],
        affectedRiskMetric: "Aggregate Other Hazards release-category frequency",
        insight: `${hazard.name} risk is controlled by the linked protection/SSC response and common environmental condition rather than source frequency alone.`,
        decisionImplication: [
          "Maintain detector response testing, protected isolation, supplied-air staging, and annual drill coverage.",
          "Verify barrier/capacity margins and control source or rotating-equipment configuration.",
          "Maintain intake loading margin, source monitoring, and long-duration recovery supplies.",
        ][index]!,
      },
    ),
  );
  mef.riskInterpretation.refinementActions = hazards.map((hazard, index) =>
    record(
      variant,
      `O-REF-${index + 1}`,
      `${hazard.name} model refinement`,
      "Records the highest-value technical refinement identified by uncertainty, sensitivity, contributor, and decision review.",
      "Priority reflects potential change in risk result or decision, information cost, lifecycle timing, and defense-in-depth value.",
      {
        technicalArea:
          index === 0 ? "INVESTIGATION"
          : index === 1 ? "FRAGILITY"
          : "HAZARD",
        priority: index < 2 ? "HIGH" : "MEDIUM",
        driverRefs: [id(variant, `O-SENS-${index + 1}`), id(variant, `O-INS-${index + 1}`)],
        refinement: [
          "Complete detector sample-line as-built confirmation and response-time test.",
          "Complete plant-specific barrier or equipment capacity calculation and independent review.",
          "Update source/seasonal monitoring and long-duration deposition/loading model.",
        ][index]!,
        expectedRiskEffect:
          "Reduces epistemic uncertainty and may lower the upper-percentile result without relying on unsupported credit.",
        ownerDiscipline: [
          "Instrumentation and HRA",
          "Structural/fragility engineering",
          "Hazard analysis and operations",
        ][index]!,
        refinementStatus: index < 2 ? "IN_PROGRESS" : "PLANNED",
      },
    ),
  );
  mef.riskInterpretation.quantificationIterations = [
    record(
      variant,
      "O-ITER-001",
      "Other Hazards model iteration 0.9",
      "Records the first integrated refinement cycle and its effect on aggregate and sequence-family results.",
      "Hazard interval, fragility, correlation, HRA, and secondary-hazard updates were quantified on a controlled prior model.",
      {
        modelVersion: `${variant}-O-MODEL-0.9`,
        priorModelVersion: `${variant}-O-MODEL-0.8`,
        changeSummary: [
          "Refined toxic dispersion bins",
          "Added common-demand correlation",
          "Updated local-action HEP",
        ],
        aggregateMeanFrequencyPerPlantYear: aggregate * 1.08,
        maximumFamilyFrequencyChange: 0.14,
        contributorRankChanges: ["Ranks 1 and 2 unchanged; ranks 3 and 4 exchanged"],
        newRiskSignificantContributors: [],
        decision: "CONTINUE_REFINEMENT",
      },
    ),
    record(
      variant,
      "O-ITER-002",
      "Other Hazards model iteration 1.0",
      "Records the final integrated refinement cycle and accepts the result as stable against controlled stopping criteria.",
      "All material refinements are incorporated; aggregate, family, and contributor results satisfy the stability checks.",
      {
        modelVersion: `${variant}-O-MODEL-1.0`,
        priorModelVersion: `${variant}-O-MODEL-0.9`,
        changeSummary: [
          "Final source survey",
          "Fragility verification",
          "Action-time confirmation",
          "Convergence rerun",
        ],
        aggregateMeanFrequencyPerPlantYear: aggregate,
        maximumFamilyFrequencyChange: 0.038,
        contributorRankChanges: ["No top-five rank change"],
        newRiskSignificantContributors: [],
        decision: "ACCEPT_STABLE",
      },
    ),
  ];
  mef.riskInterpretation.integrationResults = [
    record(
      variant,
      "O-RI-001",
      "Controlled Other Hazards risk-integration result",
      "Transfers aggregate and disaggregated plant-year results by hazard group, operating state, unit, material source, sequence family, plant-damage state, and release category.",
      "Origin tags and overlap controls prevent duplication with Fire, Flood, Seismic, High Winds, and internal-events results.",
      {
        modelVersion: `${variant}-O-MODEL-1.0`,
        hazardGroupRefs: hazardGroups.map((item) => item.uuid),
        operatingStateRefs: pos,
        unitRefs: units,
        radioactiveMaterialSourceRefs: sources,
        eventSequenceFamilyRefs: hazards.map((hazard) => `ESF-O-${hazard.code}`),
        meanFrequencyPerPlantYear: aggregate,
        fifthPercentileFrequencyPerPlantYear: aggregate * 0.23,
        ninetyFifthPercentileFrequencyPerPlantYear: aggregate * 3.7,
        plantDamageStateRefs: hazards.map((_, index) => `PDS-O-${index + 1}`),
        releaseCategoryRefs: hazards.map((_, index) => `RC-O-${index + 1}`),
        overlapTreatment:
          "All causally induced fire, flood, seismic, wind, and internal-events records retain their single controlling origin and are excluded from independent-origin totals.",
        integrationStatus: "READY_FOR_RISK_INTEGRATION",
      },
    ),
  ];
  mef.riskInterpretation.overlapControls = mef.retainedHazardGroups.overlapControls.map((control, index) => ({
    ...control,
    uuid: id(variant, `O-RIOVR-${index + 1}`),
    code: `O-RIOVR-${index + 1}`,
    name: `${control.name} at Risk Integration`,
    relatedRefs: [control.uuid, id(variant, "O-RI-001")],
  }));
  mef.riskInterpretation.riskDecisions = hazards.map((hazard, index) =>
    record(
      variant,
      `O-DEC-${index + 1}`,
      `${hazard.name} risk-informed decision`,
      "Records the design, procedure, configuration, monitoring, data, model-control, or emergency-preparedness action supported by the integrated result and sensitivity.",
      "The decision balances mean and uncertainty results, defense in depth, feasibility, lifecycle phase, and reanalysis triggers.",
      {
        decisionType:
          index === 0 ? "PROCEDURE"
          : index === 1 ? "DESIGN"
          : "MONITORING",
        driverRefs: [id(variant, `O-INS-${index + 1}`), id(variant, `O-SENS-${index + 1}`)],
        affectedSscRefs: [sscs[index]!.uuid],
        action: [
          "Add toxic-detector response test, supplied-air staging check, and multi-unit priority to the surveillance/drill program.",
          "Complete and independently verify the governing barrier/capacity calculation before baseline release.",
          "Maintain seasonal source monitoring, intake loading margin, and long-duration filter replacement strategy.",
        ][index]!,
        duePhase: index < 2 ? "Before initial fuel load" : "Operations program implementation",
        disposition: index < 2 ? "IMPLEMENT" : "MONITOR",
        verificationRefs: [id(variant, `O-REF-${index + 1}`), id(variant, "EVID-CALC")],
        reanalysisRequired: true,
        riskIntegrationResultRef: id(variant, "O-RI-001"),
      },
    ),
  );
  mef.riskInterpretation.traceabilityPaths = hazards.map((hazard, index) =>
    record(
      variant,
      `O-TRACE-${index + 1}`,
      `${hazard.name} evidence-to-decision traceability`,
      "Links the complete chain from evidence and HSA retention through source, curve, SSC, investigation, fragility, initiator, HRA, sequence result, and decision.",
      "Automated and manual checks confirm every reference exists in the controlled baseline and uses one origin tag.",
      {
        evidenceRefs: [
          id(variant, `O-DATA-${hazard.code}-01`),
          id(variant, `O-DATA-${hazard.code}-02`),
          id(variant, "EVID-INV"),
        ],
        hazardGroupRefs: [hazardGroups[index]!.uuid],
        sourceModelRefs: [
          id(variant, `O-SRC-${hazard.code}`),
          id(variant, `O-EFF-${hazard.code}`),
          id(variant, `O-FMOD-${hazard.code}`),
        ],
        hazardCurveRefs: [id(variant, `O-CURVE-${hazard.code}`)],
        sscListRefs: [sscs[index]!.uuid],
        investigationRefs: [investigationId],
        fragilityRefs: [id(variant, `O-FRAG-${index + 1}`)],
        initiatingEventRefs: [id(variant, `O-IE-${hazard.code}`)],
        humanFailureEventRefs: [hfes[index]!.uuid],
        eventSequenceFamilyRefs: [`ESF-O-${hazard.code}`],
        resultRefs: [id(variant, `O-FAMRES-${hazard.code}`), id(variant, "O-RI-001")],
        decisionRefs: [id(variant, `O-DEC-${index + 1}`)],
        complete: true,
      },
    ),
  );
  mef.riskInterpretation.controlledBaselines = [
    record(
      variant,
      "O-BASELINE-001",
      "Other Hazards controlled analysis baseline",
      "Releases the model, quantification run, report, evidence index, configuration record, peer review, limitations, and package manifest as one reproducible baseline.",
      "Configuration management verified file hashes, revisions, approvals, model inputs, software, and traceability before release.",
      {
        modelVersion: `${variant}-O-MODEL-1.0`,
        quantificationRunRef: run.uuid,
        reportRef: `${variant}-O-PRA-REPORT-R0`,
        configurationControlRecordId: mef.configurationControlRecordId,
        peerReviewRef: `${variant}-O-PEER-2026`,
        packageManifestRefs: [
          `${variant}-O-MANIFEST-001`,
          `${variant}-O-HASHES-001`,
          `${variant}-O-EVIDENCE-INDEX`,
        ],
        unresolvedLimitations: mef.metadata.limitations,
        releaseStatus: "CONTROLLED",
      },
    ),
  ];
  mef.riskInterpretation.stoppingCriteria = {
    maximumAggregateFrequencyChange: 0.05,
    maximumFamilyFrequencyChange: 0.1,
    maximumContributorRankShift: 1,
    requiredStableIterations: 2,
    requireNoNewRiskSignificantContributors: true,
    basis:
      "Consistent with the risk application, model uncertainty, numerical precision, and the requirement to avoid unresolved risk-significant contributors.",
  };

  mef.technicalClosure.conformanceReviews = ["OHA", "OFR", "OPR"].map((area) =>
    simple(
      variant,
      `O-CONFREV-${area}`,
      `${area} supporting-requirement conformance review`,
      `Confirms every applicable ${area} supporting requirement is mapped to an analysis record, evidence, capability category, plant stage, and review disposition.`,
    ),
  );
  mef.technicalClosure.documentationChecks = [
    simple(
      variant,
      "O-DOCCHECK-001",
      "Other Hazards reproducibility check",
      "Verifies the report and controlled package document scope, evidence, inputs, methods, results, uncertainty, limitations, interfaces, configuration, software, and traceability.",
    ),
  ];
  mef.technicalClosure.interfaceClosureChecks = INTERFACES.map((item) =>
    simple(
      variant,
      `O-IFCLOSE-${item.code}`,
      `${item.code} interface closure`,
      `Confirms the ${item.name} transfer records are controlled, current, consistent, accepted, traceable, and free of open items.`,
      [id(variant, `O-IF-${item.code}`)],
    ),
  );
  const reviewRoles: OtherHazardsPRA["technicalClosure"]["peerReviewTeam"][number]["role"][] = [
    "TEAM_LEAD",
    "HAZARD_SPECIALIST",
    "FRAGILITY_SPECIALIST",
    "SYSTEMS_ENGINEER",
    "HRA_SPECIALIST",
    "QUANTIFICATION_SPECIALIST",
    "LEVEL_2_SPECIALIST",
  ];
  mef.technicalClosure.peerReviewTeam = reviewRoles.map((role, index) =>
    record(
      variant,
      `O-PRTEAM-${index + 1}`,
      `${role.replace(/_/g, " ").toLowerCase()} reviewer`,
      "Records an independent peer-review team member's organization, independence, qualifications, experience, hazard experience, and assigned scope.",
      "Team composition covers OHA, OFR, OPR, investigations, HRA, quantification, Level 2, documentation, and interfaces without self-review.",
      {
        role,
        organization:
          index % 2 === 0 ? "Independent PRA Review Group" : "External Hazard Engineering Partners",
        independenceStatement:
          "No responsibility for preparing or directly supervising the reviewed Other Hazards analysis records.",
        qualifications: [
          "Relevant engineering or science degree",
          "PRA peer-review training",
          "Non-LWR and external/internal hazard methods",
        ],
        experience: [`${12 + index} years PRA or hazard analysis`, "At least three peer reviews"],
        hazardGroupExperience: hazards.map((hazard) => hazard.name),
        reviewScope: [
          index < 2 ? "OHA"
          : index < 4 ? "OFR/OPR systems"
          : index < 6 ? "HRA/quantification"
          : "Level 2 and integration",
        ],
      },
    ),
  );
  mef.technicalClosure.peerReviewFindings = [
    record(
      variant,
      "O-PRF-001",
      "Closed hazard-tail convergence fact and observation",
      "Records the review finding, significance, condition, consequence, recommendation, resolution, evidence, and verified closure.",
      "The finding was resolved by extending the upper tail and demonstrating less than one-percent change in the affected family result.",
      {
        reviewArea: "OHA",
        requirementRefs: ["OHA-B3"],
        findingCategory: "FACT_AND_OBSERVATION",
        significance: "MEDIUM",
        condition: "Initial upper-tail analysis ended before demonstrating stable conditional risk.",
        consequence: "The rare-tail contribution could have been underestimated.",
        recommendation: "Extend the tail and document sequence-frequency and rank convergence.",
        resolution:
          "Upper limit extended by 50 percent; affected result changed 0.9 percent and no contributor rank changed.",
        closureEvidenceRefs: [id(variant, "O-HCONV-TOX"), id(variant, "O-QCONV-002")],
        closureStatus: "CLOSED",
      },
    ),
  ];
  mef.technicalClosure.readinessChecks = [
    simple(
      variant,
      "O-READY-001",
      "Technical model readiness",
      "Confirms hazard, fragility, plant response, HRA, quantification, uncertainty, and traceability records are complete and internally consistent.",
    ),
    simple(
      variant,
      "O-READY-002",
      "Controlled package readiness",
      "Confirms report, evidence index, model manifest, calculations, software settings, peer-review record, limitations, and configuration-control package are ready for approval.",
    ),
  ];

  const workflowRecord = (
    code: string,
    name: string,
    type: OtherHazardsPRA["workflow"]["reportSections"][number]["workflowRecordType"],
    discipline: string,
    assignee: string,
    result: string,
  ) =>
    record(
      variant,
      code,
      name,
      "Controls a defined Other Hazards preparation, review, or approval activity using the established POS workbook workflow.",
      "The assigned role verifies the controlled evidence and model snapshot before completing the record.",
      {
        workflowRecordType: type,
        discipline,
        assignee,
        dueDate: "2026-08-30",
        result,
        verificationRefs: [mef.configurationControlRecordId ?? ""],
      },
    );
  mef.workflow.reportSections = [
    "Executive summary",
    "OHA analysis",
    "OFR analysis",
    "OPR analysis",
    "Risk integration",
    "Conformance and references",
  ].map((name, index) =>
    workflowRecord(
      `O-WF-RPT-${index + 1}`,
      name,
      "REPORT_SECTION",
      index === 0 ? "PRA integration" : name.split(" ")[0]!,
      "Other Hazards PRA Lead",
      "Drafted, cross-referenced, and checked against the controlled model.",
    ),
  );
  mef.workflow.draftQualityChecks = [
    workflowRecord(
      "O-WF-QC-001",
      "Draft model-to-report reconciliation",
      "QUALITY_CHECK",
      "PRA integration",
      "Independent checker",
      "Passed: tables, figures, results, references, limitations, and model version reconcile.",
    ),
    workflowRecord(
      "O-WF-QC-002",
      "Draft conformance and interface check",
      "QUALITY_CHECK",
      "Quality assurance",
      "QA reviewer",
      "Passed: supporting requirements and external interfaces are complete and controlled.",
    ),
  ];
  mef.workflow.reviewAssignments = [
    workflowRecord(
      "O-WF-REV-001",
      "OHA technical review assignment",
      "REVIEW_ASSIGNMENT",
      "Hazard analysis",
      "Independent hazard reviewer",
      "Assigned with controlled report, model, evidence index, and conformance matrix.",
    ),
    workflowRecord(
      "O-WF-REV-002",
      "OFR/OPR technical review assignment",
      "REVIEW_ASSIGNMENT",
      "Fragility and plant response",
      "Independent PRA reviewer",
      "Assigned with controlled calculations, HRA, quantification, and model manifest.",
    ),
  ];
  mef.workflow.reviewFindings = [
    workflowRecord(
      "O-WF-FIND-001",
      "Technical review finding closure",
      "REVIEW_FINDING",
      "Hazard analysis",
      "Other Hazards PRA Lead",
      "Resolved and verified through the peer-review finding and convergence evidence.",
    ),
  ];
  mef.workflow.approvalReadiness = [
    workflowRecord(
      "O-WF-APP-001",
      "Approval readiness confirmation",
      "APPROVAL_READINESS",
      "PRA integration",
      "Responsible manager",
      "Ready: technical review complete, comments resolved, conformance met, and configuration snapshot locked.",
    ),
  ];
  mef.workflow.approvalSignatures = [];

  const docs = [
    mef.analysisBasis.documentation,
    mef.retainedHazardGroups.documentation,
    mef.hazardSourceCharacterization.documentation,
    mef.hazardFrequencyAnalysis.documentation,
    mef.secondaryAndCombinedHazards.documentation,
    mef.hazardCurveAnalysis.documentation,
    mef.preliminaryPlantResponse.documentation,
    mef.plantInvestigation.documentation,
    mef.fragilityBasis.documentation,
    mef.fragilityAnalysis.documentation,
    mef.initiatingEventAndScenarioDevelopment.documentation,
    mef.plantResponseModel.documentation,
    mef.humanReliabilityAnalysis.documentation,
    mef.eventSequenceQuantification.documentation,
    mef.technicalClosure.documentation,
  ];
  const docNames = [
    "analysis basis and interfaces",
    "retained hazard groups",
    "source and effect characterization",
    "frequency analysis",
    "secondary and combined hazards",
    "hazard curves and intervals",
    "preliminary response and SSC scope",
    "plant investigation",
    "fragility basis",
    "fragility analysis",
    "initiating events and scenarios",
    "plant-response model",
    "human reliability",
    "quantification",
    "technical closure",
  ];
  docs.forEach((doc, index) =>
    documentSection(
      doc,
      `Develop and control the ${docNames[index]} portion of the Other Hazards PRA.`,
      "HSA routing, site and design evidence, baseline PRA records, investigations, calculations, operating experience, and external technical-element transfers.",
      "Structured hazard-to-consequence analysis with capability-appropriate screening, realistic CC-II quantification, uncertainty, independent verification, and configuration control.",
      `The controlled ${docNames[index]} records are complete, traceable, internally consistent, and ready for technical review.`,
      mef.analysisBasis.evidenceRegister.map((item) => item.uuid),
    ),
  );
  mef.documentation = {
    overallProcessDescription:
      "The workbook follows retained-hazard definition, site/source characterization, frequency and curve development, secondary-hazard control, SSC scope, investigation, fragility, scenarios, plant response, HRA, quantification, uncertainty, risk integration, and controlled technical closure.",
    analysisBasisSummary:
      "The CC-II analysis boundary covers all representative POSs, units/modules, material sources, shared systems, applications, external technical-element interfaces, and the frozen internal-events baseline.",
    siteAndEvidenceSummary:
      "Site, regional, design, configuration, operating-experience, investigation, calculation, and standard evidence are controlled to the model freeze.",
    retainedHazardsSummary: `Three HSA-retained groups are quantitatively evaluated: ${hazards.map((item) => item.name).join(", ")}.`,
    sourceCharacterizationSummary:
      "Each hazard has source inventory, location, intensity measure, effect model, spatial zone, warning, duration, and plant receptor definitions.",
    frequencyAnalysisSummary:
      "Qualified site and regional evidence supports occurrence, severity, applicability, expert-judgment, and uncertainty-frequency results.",
    secondaryHazardsSummary:
      "Causal and combined hazards are represented with accepted specialized transfers and one controlling origin tag.",
    hazardCurveSummary:
      "Mean and uncertainty-family curves are discretized into converged intervals with upper-tail treatment.",
    sscScopeSummary:
      "The Other Hazards SSC list includes all initiating, mitigation, support, protection, monitoring, confinement, and operator-action dependencies.",
    investigationSummary:
      "A multidisciplinary walkdown and tabletop confirm configuration, protection, sources, routes, procedures, actions, and controlled closeout items.",
    fragilitySummary:
      "Compatible physical and functional fragilities use plant-specific demand/capacity, generic-data applicability, secondary effects, and correlation treatment.",
    scenarioSummary:
      "Scenario families combine source, interval, location, initiator, SSC damage, secondary effects, timeline, POS, unit, and material source.",
    plantResponseSummary:
      "Baseline sequences, criteria, systems, data, mission time, recovery, correlations, multi-unit conditions, and Level 2 interfaces are adapted and verified.",
    humanReliabilitySummary:
      "Credited actions are confirmed and quantified using warning, environment, PPE, access, communication, staffing, timing, recovery, and dependency conditions.",
    quantificationSummary: `The controlled run integrates nine hazard intervals and reports an aggregate mean release-category frequency of ${aggregate.toExponential(3)} per plant-year with stable uncertainty and contributors.`,
    riskInsights:
      "Dominant risk depends on protection/SSC response and common environmental conditions; detector, barrier/capacity, and long-duration intake strategies provide actionable defense in depth.",
    uncertaintySummary:
      "Material hazard, source-to-site, fragility, correlation, plant-response, HRA, recovery, grouping, and numerical alternatives are propagated or tested explicitly.",
    configurationControlDescription: `Model ${variant}-O-MODEL-1.0, run ${run.code}, report, evidence, peer review, hashes, software, and limitations are released under ${mef.configurationControlRecordId}.`,
    peerReviewScope:
      "Independent review covers OHA, OFR, OPR, investigation, HRA, quantification, Level 2, documentation, interfaces, uncertainty, conformance, and configuration control.",
    supportingDocumentRefs: mef.analysisBasis.evidenceRegister.map((item) => item.uuid),
  };
  mef.exampleDocuments = [
    {
      id: id(variant, "DOC-SITE"),
      name: `${siteName} site and surroundings characterization.pdf`,
      kind: "doc",
      sizeLabel: "18.6 MB",
      uploadedLabel: "Controlled 2026-06-30",
      extracted:
        "Source inventories, coordinates, regional datasets, transport, air traffic, and environmental attributes",
      linked: 42,
    },
    {
      id: id(variant, "DOC-CALC"),
      name: `${variant} Other Hazards integrated calculation.xlsx`,
      kind: "sheet",
      sizeLabel: "9.8 MB",
      uploadedLabel: "Controlled 2026-08-12",
      extracted:
        "Hazard curves, fragilities, interval results, uncertainty samples, contributors, and convergence",
      linked: 67,
    },
    {
      id: id(variant, "DOC-WALK"),
      name: `${variant} Other Hazards walkdown photo log.pdf`,
      kind: "image",
      sizeLabel: "34.2 MB",
      uploadedLabel: "Controlled 2026-05-22",
      extracted: "SSCs, protection features, source locations, access routes, PPE staging, and discrepancies",
      linked: 31,
    },
  ];
  mef.newlyDevelopedMethodIds = [`${variant}-NDM-O-SOURCE-TO-SITE`, `${variant}-NDM-O-CORRELATED-QUANT`];

  const preopTargets = [
    mef.analysisBasis,
    mef.hazardSourceCharacterization,
    mef.fragilityAnalysis,
    mef.humanReliabilityAnalysis,
  ];
  const preopRoots = ["BASIS", "SOURCE", "FRAG", "HRA"];
  preopTargets.forEach((target, index) => {
    target.preOperationalAssumptions = [
      record(
        variant,
        `O-PA-${preopRoots[index]}`,
        `${docNames[index]} pre-operational closeout`,
        "Controls unavailable final as-built, test, source, or procedure information with an explicit interim model treatment and closure action.",
        "The current base model is conservative or realistic with uncertainty until objective closure evidence is accepted.",
        {
          affectedRecordRefs: [sscs[index % sscs.length]!.uuid],
          missingDesignInformation: [
            index === 0 ? "Final offsite commodity-flow survey"
            : index === 1 ? "As-built source/detector coordinates"
            : index === 2 ? "Final equipment or barrier capacity test"
            : "Final operating crew drill",
          ],
          limitation:
            "Final information could refine the mean or upper-percentile result but does not invalidate the current protected design basis.",
          closureAction:
            "Obtain controlled final evidence, reconcile the model, repeat affected sensitivities, and document approval before initial fuel load.",
          closurePhase: "Pre-operational readiness",
          closureStatus: "IN_PROGRESS",
        },
      ),
    ];
  });
  const uncertaintyTargets = [
    mef.retainedHazardGroups,
    mef.hazardSourceCharacterization,
    mef.hazardFrequencyAnalysis,
    mef.secondaryAndCombinedHazards,
    mef.hazardCurveAnalysis,
    mef.preliminaryPlantResponse,
    mef.plantInvestigation,
    mef.fragilityBasis,
    mef.fragilityAnalysis,
    mef.initiatingEventAndScenarioDevelopment,
    mef.plantResponseModel,
    mef.humanReliabilityAnalysis,
    mef.eventSequenceQuantification,
    mef.technicalClosure,
  ];
  uncertaintyTargets.forEach((target, index) => {
    target.modelUncertainties = [
      record(
        variant,
        `O-U-${index + 1}`,
        `${docNames[index + 1] ?? "technical closure"} model uncertainty`,
        "Identifies the most influential parameter, model, or assumption alternative in this section and its possible effect on results and decisions.",
        "The alternative is propagated, bounded, or tested and retained in the controlled uncertainty register.",
        {
          sourceSubelement:
            index < 5 ? "OHA"
            : index < 8 ? "OFR"
            : "OPR",
          uncertaintyType: "MODEL",
          hazardGroupRefs: hazardGroups.map((item) => item.uuid),
          affectedRecordRefs: [],
          potentialImpact:
            "May change interval risk, fragility, action HEP, sequence frequency, contributor rank, or refinement priority.",
          reasonableAlternatives: ["Central model", "Plausible adverse model", "Plausible favorable model"],
          treatment:
            "Propagated in integrated uncertainty or tested by sensitivity with decision impact documented.",
          sensitivityStudyRefs: mef.riskInterpretation.sensitivityStudies.map((item) => item.uuid),
          importance: index % 4 === 0 ? "HIGH" : "MEDIUM",
        },
      ),
    ];
  });

  const analysisRecords: OtherHazardsAnalysisRecord[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.code === "string" &&
      typeof candidate.uuid === "string" &&
      Array.isArray(candidate.implementsSrs)
    )
      analysisRecords.push(candidate as unknown as OtherHazardsAnalysisRecord);
    Object.values(candidate).forEach(visit);
  };
  visit(mef);
  Object.entries(OTHER_HAZARDS_PRA_SR_CATALOG).forEach(([sr, entry], index) =>
    analysisRecords[index % analysisRecords.length]!.implementsSrs.push({ sr, hlr: entry.hlr }),
  );
  return synchronizeOtherHazardsPraDerivedRegisters(mef);
}
