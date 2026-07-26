import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Results = SeismicPRA["seismicFragilityAnalysis"]["results"];
type Equipment =
  SeismicPRA["seismicPlantResponseAnalysis"]["seismicEquipmentListDevelopment"]["equipment"][number];
type FailureMechanism = Results["failureMechanisms"][number];
type FragilityEvaluation = Results["fragilityEvaluations"][number];
type FragilityMechanismType = FailureMechanism["mechanismType"];
type AnalysisCategory = FragilityEvaluation["analysisCategory"];
type EvaluationBasis = FragilityEvaluation["evaluationBasis"];

interface FragilityTemplate {
  id: string;
  equipmentId: string;
  mechanismType: FragilityMechanismType;
  analysisCategory: AnalysisCategory;
  evaluationBasis: EvaluationBasis;
  median: number;
  betaR: number;
  betaU: number;
  importance: ImportanceLevel;
  correlationRef: string;
  capacityParameter: string;
  capacityEvidence: string[];
  demandParameter: string;
  demandMethod: string;
  description: string;
  selectionBasis: string;
  plantSpecific?: boolean;
  genericDataJustification?: string;
  thresholdMethodRef?: string;
  thresholdSatisfied?: boolean;
  sensitivityRefs: string[];
  assumptions: string[];
  limitations?: string[];
}

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (
    (
      (
        (
          (1.061405429 * t - 1.453152027) * t
          + 1.421413741
        ) * t - 0.284496736
      ) * t + 0.254829592
    ) * t
  ) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function fragilityCurve(
  medianCapacity: number,
  logarithmicStandardDeviation: number,
): FragilityEvaluation["meanFragilityCurve"] {
  return Array.from({ length: 25 }, (_, index) => {
    const groundMotion = medianCapacity * Math.exp(-2.4 + index * 0.2);
    const probability = normalCdf(
      Math.log(groundMotion / medianCapacity)
      / Math.max(logarithmicStandardDeviation, 0.01),
    );
    return {
      groundMotion: Number(groundMotion.toPrecision(6)),
      conditionalFailureProbability: Number(
        Math.min(0.999999, Math.max(0.000001, probability)).toPrecision(7),
      ),
    };
  });
}

function fragilityCurveAtMotions(
  groundMotions: number[],
  medianCapacity: number,
  logarithmicStandardDeviation: number,
): FragilityEvaluation["meanFragilityCurve"] {
  return groundMotions.map((groundMotion) => {
    const probability = normalCdf(
      Math.log(groundMotion / medianCapacity)
      / Math.max(logarithmicStandardDeviation, 0.01),
    );
    return {
      groundMotion,
      conditionalFailureProbability: Number(
        Math.min(0.999999, Math.max(0.000001, probability)).toPrecision(7),
      ),
    };
  });
}

function uncertaintyCurves(
  medianCapacity: number,
  betaR: number,
  betaU: number,
): NonNullable<FragilityEvaluation["uncertaintyFractileCurves"]> {
  const groundMotions = fragilityCurve(
    medianCapacity,
    Math.sqrt(betaR ** 2 + betaU ** 2),
  ).map((point) => point.groundMotion);
  return [
    {
      fractile: 0.05,
      points: fragilityCurveAtMotions(
        groundMotions,
        medianCapacity * Math.exp(1.644854 * betaU),
        betaR,
      ),
    },
    {
      fractile: 0.5,
      points: fragilityCurveAtMotions(
        groundMotions,
        medianCapacity,
        betaR,
      ),
    },
    {
      fractile: 0.95,
      points: fragilityCurveAtMotions(
        groundMotions,
        medianCapacity * Math.exp(-1.644854 * betaU),
        betaR,
      ),
    },
  ];
}

function equipmentRef(kind: ReactorKind, id: string): string {
  return id === "PRIMARY" || id === "SECONDARY"
    ? `SEL-${id}`
    : `SEL-${kind.toUpperCase()}-${id}`;
}

function equipmentById(
  equipment: Equipment[],
  kind: ReactorKind,
  id: string,
): Equipment {
  const ref = equipmentRef(kind, id);
  const item = equipment.find((candidate) => candidate.uuid === ref);
  if (item === undefined) {
    throw new Error(`Missing seismic equipment ${ref}`);
  }
  return item;
}

function reactorTemplates(kind: ReactorKind): FragilityTemplate[] {
  const isSfr = kind === "sfr";
  return [
    {
      id: "PRIMARY",
      equipmentId: "PRIMARY",
      mechanismType: "FUNCTIONAL_FAILURE",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.18 : 1.32,
      betaR: 0.28,
      betaU: 0.34,
      importance: ImportanceLevel.HIGH,
      correlationRef: "CORR-COLOCATED-EQUIPMENT",
      capacityParameter: isSfr
        ? "Pump coastdown and shaft-alignment acceleration capacity"
        : "Circulator bearing and rotor functional acceleration capacity",
      capacityEvidence: isSfr
        ? ["SFR-PUMP-COASTDOWN-TEST-014", "SFR-PUMP-SUPPORT-CALC-061"]
        : ["HTGR-CIRCULATOR-QUAL-022", "HTGR-CIRCULATOR-SUPPORT-CALC-047"],
      demandParameter: "Three-direction floor spectral acceleration and connected-line load",
      demandMethod: "Separation-of-variables calculation using the local median FRS, equipment amplification, and connected-service displacement.",
      description: isSfr
        ? "Loss of coastdown or rotor alignment from combined pump-deck inertia, support deformation, and connected sodium-line demand."
        : "Loss of helium circulation from combined rotor, bearing, casing-support, and connected helium-line demand.",
      selectionBasis: "The functional mechanism has the lowest realistic plant-specific capacity among the credible inertia, anchorage, and interaction mechanisms.",
      sensitivityRefs: ["SENS-FRAGILITY-BETA", "SENS-DEMAND-SCALE", "SENS-CONNECTED-LINE"],
      assumptions: [
        "Operating mass and thermal alignment match the controlled equipment configuration.",
        "Connected-service supports remain within the investigated gap and stiffness range.",
      ],
      limitations: ["Confirm final vendor acceptance-test record and as-built support gaps."],
    },
    {
      id: "SECONDARY",
      equipmentId: "SECONDARY",
      mechanismType: isSfr ? "DIFFERENTIAL_SETTLEMENT" : "ANCHORAGE_FAILURE",
      analysisCategory: isSfr ? "SOIL" : "GENERAL_SSC",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 0.92 : 1.08,
      betaR: 0.31,
      betaU: 0.38,
      importance: ImportanceLevel.HIGH,
      correlationRef: isSfr ? "CORR-SOIL-DEFORMATION" : "CORR-COLOCATED-EQUIPMENT",
      capacityParameter: isSfr
        ? "Equivalent PGA capacity for settlement-induced support and piping distortion"
        : "RCCS panel support and header anchorage acceleration capacity",
      capacityEvidence: isSfr
        ? ["SFR-DHR-FOUNDATION-089", "SFR-BURIED-PIPING-FLEX-031"]
        : ["HTGR-RCCS-PANEL-ANCH-076", "HTGR-RCCS-HEADER-STRESS-033"],
      demandParameter: isSfr
        ? "Differential settlement, lateral spreading, and local structural response"
        : "Panel in-plane and out-of-plane acceleration with header displacement",
      demandMethod: isSfr
        ? "Joint soil-deformation and equipment-response fragility conditioned on foundation PGA."
        : "Local response-to-capacity calculation for panel supports, header guides, and credited natural-circulation geometry.",
      description: isSfr
        ? "Localized deformation of the shallow air-cooler foundation and buried service connections can remove the credited passive heat-rejection train."
        : "Support or header anchorage failure can breach the credited RCCS heat-removal flow path.",
      selectionBasis: isSfr
        ? "The retained site-specific deformation mechanism controls the lower-tail capacity."
        : "Panel anchorage controls over panel yielding, header rupture, and global RCCS-structure response.",
      sensitivityRefs: isSfr
        ? ["SENS-FRAGILITY-BETA", "SENS-SOIL-MECHANISM"]
        : ["SENS-FRAGILITY-BETA", "SENS-DEMAND-SCALE"],
      assumptions: [
        isSfr
          ? "The selected loose-layer branch bounds the air-cooler foundation footprint."
          : "Panel water inventory and support clearances are within the controlled operating range.",
      ],
      limitations: ["Confirm final foundation and connected-piping configuration."],
    },
    {
      id: "SOIL",
      equipmentId: "REACTOR-BUILDING",
      mechanismType: "DIFFERENTIAL_SETTLEMENT",
      analysisCategory: "SOIL",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.46 : 1.58,
      betaR: 0.29,
      betaU: 0.42,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-SOIL-DEFORMATION",
      capacityParameter: "Foundation-PGA capacity for tolerable settlement and tilt",
      capacityEvidence: [
        `${kind.toUpperCase()}-GEOTECH-CAPACITY-042`,
        `${kind.toUpperCase()}-FOUNDATION-DISTORTION-018`,
      ],
      demandParameter: "Liquefaction settlement, permanent ground deformation, and foundation tilt",
      demandMethod: "Site-specific triggering, reconsolidation settlement, and foundation-distortion calculation integrated over the retained soil profiles.",
      description: "Loss of structural or supported-SSC function caused by site-specific permanent ground deformation.",
      selectionBasis: "Liquefaction-induced differential settlement bounds the evaluated slope-instability and uniform-settlement alternatives.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-STRUCTURE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-SOIL-MECHANISM", "SENS-DEMAND-SCALE"],
      assumptions: ["Groundwater and density branches span the site investigation measurements."],
      limitations: ["Confirm excavation-bottom density and groundwater monitoring before operation."],
    },
    {
      id: "STRUCTURE",
      equipmentId: "REACTOR-BUILDING",
      mechanismType: "STRUCTURAL_YIELDING",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 2.15 : 2.28,
      betaR: 0.24,
      betaU: 0.31,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-REACTOR-STRUCTURE",
      capacityParameter: "Foundation-PGA capacity for shear-wall yielding and drift",
      capacityEvidence: [
        `${kind.toUpperCase()}-NONLINEAR-STRUCTURAL-112`,
        `${kind.toUpperCase()}-SHEARWALL-CAPACITY-207`,
      ],
      demandParameter: "Three-direction structural force, story drift, and diaphragm rotation",
      demandMethod: "Nonlinear static and response-history capacity evaluation with median-centered structural demand.",
      description: "Global shear-wall yielding or excessive drift can challenge the common support and protection functions.",
      selectionBasis: "Global wall yielding controls over sliding, overturning, diaphragm, and basemat mechanisms.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-STRUCTURE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-DEMAND-SCALE", "SENS-FRAGILITY-BETA"],
      assumptions: ["Median cracked stiffness and damping represent the operating structure."],
    },
    {
      id: "VESSEL",
      equipmentId: "REACTOR-VESSEL",
      mechanismType: "PRESSURE_BOUNDARY_FAILURE",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.94 : 2.08,
      betaR: 0.23,
      betaU: 0.3,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-REACTOR-STRUCTURE",
      capacityParameter: "Support and pressure-boundary acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-VESSEL-SUPPORT-096`,
        `${kind.toUpperCase()}-VESSEL-STRESS-141`,
      ],
      demandParameter: "Support reactions, nozzle loads, shell stress, and relative displacement",
      demandMethod: "Combined inertial, pressure, thermal, and support-displacement demand-to-capacity evaluation.",
      description: "Loss of vessel support alignment or pressure-boundary integrity under combined seismic and operating loads.",
      selectionBasis: "Support-skirt or support-key demand controls over shell buckling and nozzle failure.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-STRUCTURE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-DEMAND-SCALE", "SENS-FRAGILITY-BETA"],
      assumptions: ["Operating pressure, temperature, and support preload are represented at median conditions."],
    },
    {
      id: "RELAY",
      equipmentId: "RTS-RELAY",
      mechanismType: "CONTACT_CHATTER",
      analysisCategory: "CONTACT_CHATTER",
      evaluationBasis: "GENERIC_TEST_DATA",
      median: isSfr ? 2.42 : 2.56,
      betaR: 0.27,
      betaU: 0.36,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-CONTROL-CABINET",
      capacityParameter: "Cabinet-level chatter acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-RELAY-TEST-011`,
        `${kind.toUpperCase()}-RELAY-MOUNT-COMPARE-005`,
      ],
      demandParameter: "Amplified cabinet response at contact-sensitive frequencies",
      demandMethod: "Test-spectrum comparison at the installed orientation with cabinet amplification and contact-state correction.",
      description: "Transient relay contact motion can spuriously actuate or fail to actuate credited protection logic.",
      selectionBasis: "The lowest chatter threshold among the energized and de-energized credited contact states controls.",
      plantSpecific: false,
      genericDataJustification: "The tested relay model, contact form, socket, restraint clip, orientation, electrical state, and cabinet spectrum envelope match the installed configuration; the plant-specific comparison retains test-to-installation uncertainty.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-RELAY`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-RELAY-POPULATION", "SENS-CORRELATION"],
      assumptions: ["Installed relay model, socket, clip, and orientation match the qualified population."],
      limitations: ["Confirm procurement and as-installed relay nameplate data."],
    },
    {
      id: "CABINET",
      equipmentId: "RTS-CABINET",
      mechanismType: "FUNCTIONAL_FAILURE",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "SEISMIC_QUALIFICATION_DATA",
      median: isSfr ? 1.76 : 1.9,
      betaR: 0.3,
      betaU: 0.33,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-CONTROL-CABINET",
      capacityParameter: "Internal-module functional acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-CABINET-QUAL-029`,
        `${kind.toUpperCase()}-MODULE-RESTRAINT-128`,
      ],
      demandParameter: "Cabinet frame and internal-module response",
      demandMethod: "Qualified test response spectrum compared with the calculated cabinet response including frame amplification.",
      description: "Loss of cabinet function from internal-module, connector, bus, or cabinet anchorage response.",
      selectionBasis: "Internal plug-in module restraint controls over frame and floor anchorage.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-ELECTRICAL`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-DEMAND-SCALE", "SENS-CORRELATION"],
      assumptions: ["Internal modules and cable dress match the qualified cabinet configuration."],
    },
    {
      id: "BATTERY",
      equipmentId: "DC-BATTERY-A",
      mechanismType: "ANCHORAGE_FAILURE",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "PLANT_SPECIFIC_TEST",
      median: isSfr ? 1.88 : 2.02,
      betaR: 0.26,
      betaU: 0.3,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-DC-POWER",
      capacityParameter: "Rack anchorage and cell-connection acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-BATTERY-RACK-TEST-018`,
        `${kind.toUpperCase()}-BATTERY-ANCHOR-054`,
      ],
      demandParameter: "Rack acceleration, overturning moment, anchor tension, and terminal displacement",
      demandMethod: "Plant-specific rack test and anchorage calculation scaled to the local floor response.",
      description: "Rack sliding, overturning, anchor failure, or intercell-connection separation can remove credited DC power.",
      selectionBasis: "Anchor tension and terminal flexibility jointly control the evaluated rack capacity.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-ELECTRICAL`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-FRAGILITY-BETA", "SENS-CORRELATION"],
      assumptions: ["Cell spacers, terminal slack, and anchor torque remain within the qualified tolerances."],
    },
    {
      id: "FLOOD-1",
      equipmentId: "SERVICE-WATER",
      mechanismType: "FLOOD_RELEASE",
      analysisCategory: "FLOOD_SOURCE",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.52 : 1.63,
      betaR: 0.3,
      betaU: 0.39,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-FLOOD-SOURCES",
      capacityParameter: "Pipe, support, and spray-release acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-SERVICE-WATER-STRESS-052`,
        `${kind.toUpperCase()}-FLOOD-CONSEQUENCE-016`,
      ],
      demandParameter: "Pipe support acceleration, differential displacement, and branch/nozzle load",
      demandMethod: "Local response and correlated support-motion calculation coupled to the flood and spray consequence model.",
      description: "Seismic rupture can create spray or flooding that disables adjacent electrical divisions.",
      selectionBasis: "Branch connection rupture controls over main-header yielding and support failure.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-SOURCE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-SOURCE-CAPACITY", "SENS-CONNECTED-LINE"],
      assumptions: ["Room drainage and credited spray shields match the flood model configuration."],
    },
    {
      id: "FLOOD-2",
      equipmentId: isSfr ? "STEAM-WATER" : "RCCS-WATER",
      mechanismType: "FLOOD_RELEASE",
      analysisCategory: "FLOOD_SOURCE",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.41 : 1.72,
      betaR: 0.32,
      betaU: 0.41,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-FLOOD-SOURCES",
      capacityParameter: isSfr
        ? "Feedwater boundary rupture acceleration capacity"
        : "Expansion-tank shell, leg, and nozzle acceleration capacity",
      capacityEvidence: isSfr
        ? ["SFR-FEEDWATER-STRESS-073", "SFR-SODIUM-WATER-CONSEQUENCE-021"]
        : ["HTGR-RCCS-TANK-ANCHOR-034", "HTGR-RCCS-DRAINDOWN-009"],
      demandParameter: "Boundary stress, support load, nozzle load, and differential displacement",
      demandMethod: "Plant-specific boundary and support capacity coupled to the retained flood consequence.",
      description: isSfr
        ? "Feedwater-line rupture can flood the steam-generator bay and initiate a sodium-water interaction."
        : "Expansion-tank rupture can drain RCCS inventory and flood the upper service gallery.",
      selectionBasis: isSfr
        ? "Branch-line rupture controls the coupled flood and sodium-water consequence."
        : "Tank-leg buckling and outlet-nozzle demand define the controlling release capacity.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-SOURCE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-SOURCE-CAPACITY", "SENS-CORRELATION"],
      assumptions: ["Source inventory and isolation state match the internal-flood boundary conditions."],
    },
    {
      id: "FIRE-1",
      equipmentId: isSfr ? "SODIUM-PIPING" : "TRANSFORMER",
      mechanismType: "FIRE_IGNITION",
      analysisCategory: "FIRE_SOURCE",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.47 : 1.58,
      betaR: 0.31,
      betaU: 0.4,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-FIRE-SOURCES",
      capacityParameter: isSfr
        ? "Sodium piping leak-and-ignition acceleration capacity"
        : "Transformer anchorage, bushing, and oil-release acceleration capacity",
      capacityEvidence: isSfr
        ? ["SFR-SODIUM-PIPING-STRESS-082", "SFR-FIRE-IGNITION-027"]
        : ["HTGR-TRANSFORMER-ANCHOR-041", "HTGR-OIL-FIRE-CONSEQUENCE-018"],
      demandParameter: "Source-boundary, support, connected-line, and ignition demands",
      demandMethod: "Plant-specific boundary fragility combined with conditional ignition and fire-propagation treatment.",
      description: isSfr
        ? "Seismic sodium-piping rupture and ignition can challenge separated heat-transport equipment and access."
        : "Transformer movement or bushing failure can release and ignite insulating oil near power-distribution equipment.",
      selectionBasis: "The lowest credible release-and-ignition path controls the source fragility.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-SOURCE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-SOURCE-CAPACITY", "SENS-CORRELATION"],
      assumptions: ["Combustible inventory, detection, suppression, and separation match the fire model."],
    },
    {
      id: "FIRE-2",
      equipmentId: isSfr ? "SODIUM-STORAGE" : "BATTERY-CHARGER",
      mechanismType: "FIRE_IGNITION",
      analysisCategory: "FIRE_SOURCE",
      evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
      median: isSfr ? 1.62 : 1.74,
      betaR: 0.29,
      betaU: 0.38,
      importance: ImportanceLevel.MEDIUM,
      correlationRef: "CORR-FIRE-SOURCES",
      capacityParameter: isSfr
        ? "Drain-tank shell, anchorage, nozzle, and sodium-release capacity"
        : "Charger cabinet anchorage and electrical ignition capacity",
      capacityEvidence: isSfr
        ? ["SFR-DRAIN-TANK-ANCHOR-038", "SFR-SODIUM-FIRE-CONSEQUENCE-031"]
        : ["HTGR-CHARGER-QUAL-026", "HTGR-DC-FIRE-CONSEQUENCE-014"],
      demandParameter: "Local acceleration, anchorage, internal assembly, and release demand",
      demandMethod: "Source-specific response-to-capacity calculation with conditional ignition and room consequence.",
      description: isSfr
        ? "Tank or connected-line failure can release sodium into the service cell and produce a sustained fire."
        : "Cabinet movement or internal electrical damage can ignite a fire in the DC equipment room.",
      selectionBasis: "The controlling release or ignition mechanism is retained through the fire-consequence interface.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-SOURCE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-SOURCE-CAPACITY", "SENS-DEMAND-SCALE"],
      assumptions: ["Source configuration and fire barriers remain consistent with the reviewed design."],
    },
    {
      id: "INTERACTION",
      equipmentId: "CABLE-TRAYS",
      mechanismType: "BRACING_FAILURE",
      analysisCategory: "GENERAL_SSC",
      evaluationBasis: "EARTHQUAKE_EXPERIENCE",
      median: isSfr ? 2.06 : 2.18,
      betaR: 0.34,
      betaU: 0.37,
      importance: ImportanceLevel.LOW,
      correlationRef: "CORR-SPATIAL-INTERACTIONS",
      capacityParameter: "Tray-support and separation acceleration capacity",
      capacityEvidence: [
        `${kind.toUpperCase()}-RACEWAY-SAMPLE-017`,
        `${kind.toUpperCase()}-INTERACTION-REGISTER-008`,
      ],
      demandParameter: "Support acceleration, brace load, differential displacement, and clearance",
      demandMethod: "Experience-based support capacity adjusted for plant-specific span, loading, bracing, and separation.",
      description: "Localized support failure or contact can damage separated protection and DC cable divisions.",
      selectionBasis: "The nonstandard transition controls over the standard braced-tray population.",
      thresholdMethodRef: `THRESHOLD-${kind.toUpperCase()}-STRUCTURE`,
      thresholdSatisfied: true,
      sensitivityRefs: ["SENS-INTERACTION-CLEARANCE", "SENS-CORRELATION"],
      assumptions: ["Tray loading, span, brace, and clearance remain within the investigated envelope."],
      limitations: ["Confirm the nonstandard transition during the final as-built walkdown."],
    },
  ];
}

function populateFragilityResults(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  const prefix = kind.toUpperCase();
  const sfr = mef.seismicFragilityAnalysis;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const responseResults = sfr.seismicResponseAnalysis.responseResults;
  const templates = reactorTemplates(kind);

  const mechanisms: FailureMechanism[] = [];
  const evaluations: FragilityEvaluation[] = [];
  for (const template of templates) {
    const item = equipmentById(equipment, kind, template.equipmentId);
    const failureMode = item.failureModes[0]!;
    const responseRef = responseResults.find((result) =>
      result.applicableSscRefs.includes(item.uuid))?.uuid
      ?? responseResults[0]?.uuid
      ?? "";
    const mechanismRef = `MECHANISM-${template.id}`;
    const fragilityRef = `FRAGILITY-${template.id}`;
    const categoryQualifier: Record<AnalysisCategory, string> = {
      GENERAL_SSC: "",
      SOIL: "soil",
      CONTACT_CHATTER: "contact chatter",
      FLOOD_SOURCE: "flood source",
      FIRE_SOURCE: "fire source",
    };
    const interactionRefs = sfr.plantInvestigations
      .flatMap((investigation) => investigation.findings)
      .filter((finding) => finding.sscRef === item.uuid && finding.credible)
      .map((finding) => finding.uuid);
    const plantSpecific = template.plantSpecific ?? true;
    const compositeBeta = Math.sqrt(template.betaR ** 2 + template.betaU ** 2);
    const hclpf = template.median
      * Math.exp(-1.644854 * (template.betaR + template.betaU));

    mechanisms.push({
      uuid: mechanismRef,
      name: `${item.name}: ${template.description.split(".")[0]}`,
      sscRef: item.uuid,
      systemsFailureModeRef: failureMode.uuid,
      mechanismType: template.mechanismType,
      failureModeType: failureMode.failureModeType,
      description: template.description,
      demandParameter: template.demandParameter,
      demandUnits: "g",
      demandResultRefs: responseRef.length > 0 ? [responseRef] : [],
      capacityParameter: template.capacityParameter,
      capacityUnits: "g",
      capacityDataRefs: template.capacityEvidence,
      anchorageAndSupportLoadPath: item.mountingAndAnchorage,
      interactionRefs,
      conservativeBounding: false,
      realisticForRiskSignificantSsc: true,
      controlling: true,
      selectionBasis: template.selectionBasis,
      implementsSrs: template.analysisCategory === "SOIL"
        ? srs("SFR-E1", "SFR-E2")
        : srs("SFR-E1", "SFR-E3"),
    });

    evaluations.push({
      uuid: fragilityRef,
      name: [
        item.name,
        categoryQualifier[template.analysisCategory],
        "fragility",
      ].filter((part) => part.length > 0).join(" "),
      sscRef: item.uuid,
      systemsFailureModeRef: failureMode.uuid,
      mechanismRefs: [mechanismRef],
      controllingMechanismRef: mechanismRef,
      analysisCategory: template.analysisCategory,
      evaluationBasis: template.evaluationBasis,
      plantSpecific,
      genericDataJustification: template.genericDataJustification,
      riskSignificance: template.importance,
      groundMotionParameterRef: template.mechanismType === "CONTACT_CHATTER"
        ? "GMP-H-SA-10HZ"
        : "GMP-H-PGA",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      medianCapacity: template.median,
      capacityUnits: "g",
      betaRandomness: template.betaR,
      betaUncertainty: template.betaU,
      compositeBeta: Number(compositeBeta.toPrecision(5)),
      highConfidenceLowProbabilityOfFailureCapacity: Number(hclpf.toPrecision(4)),
      meanFragilityCurve: fragilityCurve(template.median, compositeBeta),
      uncertaintyFractileCurves: uncertaintyCurves(
        template.median,
        template.betaR,
        template.betaU,
      ),
      demandToCapacityMethod: template.demandMethod,
      responseResultRefs: responseRef.length > 0 ? [responseRef] : [],
      capacityDataRefs: template.capacityEvidence,
      correlationGroupRefs: [template.correlationRef],
      thresholdMethodRef: template.thresholdMethodRef,
      thresholdSatisfied: template.thresholdSatisfied ?? false,
      maskingEvaluation: "The evaluated mechanism is retained explicitly or demonstrated to remain bounding; no higher-capacity alternative masks a lower-capacity credited failure mode.",
      sensitivityStudyRefs: template.sensitivityRefs,
      assumptions: template.assumptions,
      limitations: template.limitations ?? [],
      implementsSrs: srs(
        "SFR-E1",
        "SFR-E2",
        "SFR-E3",
        "SFR-E4",
        "SFR-E5",
        "SFR-E6",
        "SFR-E7",
      ),
    });
  }

  const members = (...ids: string[]): string[] =>
    ids.map((id) => equipmentById(equipment, kind, id).uuid);
  const correlationGroups: Results["correlationGroups"] = [
    {
      uuid: "CORR-COLOCATED-EQUIPMENT",
      name: "Risk-significant active equipment",
      memberSscRefs: members("PRIMARY", "SECONDARY"),
      correlationModel: "PARTIAL",
      correlationCoefficient: 0.45,
      commonDemandBasis: "Common reference earthquake, foundation input, and shared structural-response variability.",
      constructionSimilarity: "Different equipment designs and failure mechanisms.",
      installationSimilarity: "Controlled plant installation practices with distinct supports and anchors.",
      locationAndOrientationSimilarity: "Different response locations and orientations retain partially correlated motion.",
      capacitySimilarity: "Capacities are independent except for common installation and qualification uncertainty.",
      modelingImplementation: "Gaussian-copula sampling of common demand with independent mechanism-specific capacity variables.",
      justification: "Response simulations support partial demand correlation while physical differences preclude perfect capacity correlation.",
      sensitivityStudyRefs: ["SENS-CORRELATION"],
      implementsSrs: srs("SFR-E3", "SFR-E6"),
    },
    {
      uuid: "CORR-REACTOR-STRUCTURE",
      name: "Reactor structure and vessel load path",
      memberSscRefs: members("REACTOR-BUILDING", "REACTOR-VESSEL"),
      correlationModel: "CAUSAL_DEPENDENCY",
      commonDemandBasis: "Vessel demand is generated by the reactor-building and support response.",
      constructionSimilarity: "Distinct concrete-structure and vessel-support capacities.",
      installationSimilarity: "The vessel support is integral to the reactor-building load path.",
      locationAndOrientationSimilarity: "Common support elevation and coupled three-direction response.",
      capacitySimilarity: "Capacity variables are separate, with a shared support-condition uncertainty.",
      causalLogicRef: "STRUCTURAL-MODEL-RB",
      modelingImplementation: "Common structural-demand samples feed separate structure and vessel capacity checks.",
      justification: "Shared demand is causal; independent material and mechanism capacities prevent a perfect-correlation treatment.",
      sensitivityStudyRefs: ["SENS-CORRELATION", "SENS-DEMAND-SCALE"],
      implementsSrs: srs("SFR-E1", "SFR-E6"),
    },
    {
      uuid: "CORR-SOIL-DEFORMATION",
      name: "Site deformation and supported SSCs",
      memberSscRefs: kind === "sfr"
        ? members("REACTOR-BUILDING", "SECONDARY")
        : members("REACTOR-BUILDING"),
      correlationModel: "PARTIAL",
      correlationCoefficient: kind === "sfr" ? 0.7 : 0.6,
      commonDemandBasis: "Common groundwater, soil-profile, and earthquake loading branches.",
      constructionSimilarity: "Foundation types and supported equipment differ.",
      installationSimilarity: "Site preparation and backfill controls are shared within each foundation footprint.",
      locationAndOrientationSimilarity: "Spatially varying deformation is sampled with footprint-specific settlement.",
      capacitySimilarity: "Foundation and connected-service deformation capacities are evaluated separately.",
      modelingImplementation: "Shared soil-branch sampling with location-specific deformation residuals.",
      justification: "Geotechnical state variables are common but spatial variation and foundation response remain distinct.",
      sensitivityStudyRefs: ["SENS-SOIL-MECHANISM", "SENS-CORRELATION"],
      implementsSrs: srs("SFR-E2", "SFR-E6"),
    },
    {
      uuid: "CORR-CONTROL-CABINET",
      name: "Protection cabinet and relay response",
      memberSscRefs: members("RTS-CABINET", "RTS-RELAY"),
      correlationModel: "CAUSAL_DEPENDENCY",
      commonDemandBasis: "The relay input spectrum is the amplified response of its host protection cabinet.",
      constructionSimilarity: "Relay contacts and cabinet frame have different capacity mechanisms.",
      installationSimilarity: "Relay mounting is fixed to the qualified cabinet internal panel.",
      locationAndOrientationSimilarity: "Common cabinet and orientation for the evaluated channel.",
      capacitySimilarity: "Relay chatter and cabinet functional capacities are separate.",
      causalLogicRef: `BE-${equipmentById(equipment, kind, "RTS-CABINET").uuid}`,
      modelingImplementation: "Cabinet response is sampled once and propagated to the cabinet and relay conditional failures.",
      justification: "A causal demand link avoids double-counting cabinet amplification while preserving distinct capacities.",
      sensitivityStudyRefs: ["SENS-RELAY-POPULATION", "SENS-CORRELATION"],
      implementsSrs: srs("SFR-E4", "SFR-E6"),
    },
    {
      uuid: "CORR-DC-POWER",
      name: "DC battery rack installation",
      memberSscRefs: members("DC-BATTERY-A", "DC-BATTERY-B"),
      correlationModel: "PARTIAL",
      correlationCoefficient: 0.35,
      commonDemandBasis: "Common control-building input with division-specific floor response.",
      constructionSimilarity: "Common rack and cell design.",
      installationSimilarity: "Separate rooms and anchor installations.",
      locationAndOrientationSimilarity: "Comparable elevations with mirrored orientations.",
      capacitySimilarity: "Test-derived capacity is shared; installation residuals are independent.",
      modelingImplementation: "Common test-capacity variable and building demand with division-specific installation factors.",
      justification: "Common design supports shared uncertainty, while physical separation limits conditional dependence.",
      sensitivityStudyRefs: ["SENS-CORRELATION"],
      implementsSrs: srs("SFR-E3", "SFR-E6"),
    },
    {
      uuid: "CORR-FLOOD-SOURCES",
      name: "Seismic flood-source boundaries",
      memberSscRefs: kind === "sfr"
        ? members("SERVICE-WATER", "STEAM-WATER")
        : members("SERVICE-WATER", "RCCS-WATER"),
      correlationModel: "PARTIAL",
      correlationCoefficient: 0.3,
      commonDemandBasis: "Common earthquake input with source-specific response and support motions.",
      constructionSimilarity: "Both are fluid boundaries, but materials, pressure, diameter, and supports differ.",
      installationSimilarity: "Independent rooms, supports, and drainage paths.",
      locationAndOrientationSimilarity: "Different structures and elevations reduce response correlation.",
      capacitySimilarity: "Separate stress calculations and consequence thresholds.",
      modelingImplementation: "Shared earthquake sample with independent source-capacity residuals.",
      justification: "Common input is retained without assuming common rupture capacity.",
      sensitivityStudyRefs: ["SENS-SOURCE-CAPACITY", "SENS-CORRELATION"],
      implementsSrs: srs("SFR-E5", "SFR-E6"),
    },
    {
      uuid: "CORR-FIRE-SOURCES",
      name: "Seismic fire ignition sources",
      memberSscRefs: kind === "sfr"
        ? members("SODIUM-PIPING", "SODIUM-STORAGE")
        : members("TRANSFORMER", "BATTERY-CHARGER"),
      correlationModel: "PARTIAL",
      correlationCoefficient: 0.25,
      commonDemandBasis: "Common earthquake input with source- and location-specific structural response.",
      constructionSimilarity: "Release and ignition mechanisms differ between the two source types.",
      installationSimilarity: "Independent supports, barriers, detection, and suppression zones.",
      locationAndOrientationSimilarity: "Separated locations limit conditional dependence.",
      capacitySimilarity: "Each source uses separate boundary and ignition data.",
      modelingImplementation: "Common ground-motion sample with independent release and ignition-capacity residuals.",
      justification: "Only the hazard input is appreciably common.",
      sensitivityStudyRefs: ["SENS-SOURCE-CAPACITY", "SENS-CORRELATION"],
      implementsSrs: srs("SFR-E5", "SFR-E6"),
    },
    {
      uuid: "CORR-SPATIAL-INTERACTIONS",
      name: "Localized seismic interactions",
      memberSscRefs: members("CABLE-TRAYS"),
      correlationModel: "INDEPENDENT",
      commonDemandBasis: "Each localized configuration uses its controlling support response.",
      constructionSimilarity: "Standard supports share a catalog basis; exceptions retain individual checks.",
      installationSimilarity: "Span, brace, loading, and clearance are location-specific.",
      locationAndOrientationSimilarity: "Separated interaction locations have distinct response and orientation.",
      capacitySimilarity: "Catalog capacity is adjusted by plant-specific configuration factors.",
      modelingImplementation: "Localized interaction failures are independent conditional on structural response.",
      justification: "No common physical failure or shared support exists across the retained exception locations.",
      sensitivityStudyRefs: ["SENS-INTERACTION-CLEARANCE"],
      implementsSrs: srs("SFR-E1", "SFR-E6"),
    },
  ];

  const fragilityRefs = evaluations.map((evaluation) => evaluation.uuid);
  const allSscRefs = evaluations.map((evaluation) => evaluation.sscRef);
  const uncertainties: Results["uncertainties"] = [
    {
      uuid: `UNC-${prefix}-RESPONSE`,
      name: "Structural response variability",
      uncertaintyType: "PARAMETER_ALEATORY",
      description: "Record-to-record motion, damping, stiffness, and directional response affect local seismic demand.",
      affectedSscRefs: allSscRefs,
      affectedFragilityRefs: fragilityRefs,
      relatedAssumptions: ["Reference-earthquake suites span the hazard-consistent motion population."],
      reasonableAlternatives: ["Alternate record suites", "Wider damping and stiffness distributions"],
      treatment: "Sampled in the probabilistic response analysis and propagated through demand-to-capacity calculations.",
      estimatedCapacityImpact: { lowerFactor: 0.88, upperFactor: 1.12 },
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-SSI`,
      name: "Soil profile and SSI model",
      uncertaintyType: "MODEL",
      description: "Soil layering, modulus reduction, damping, embedment, and permanent-deformation models affect foundation demand.",
      affectedSscRefs: correlationGroups.find((group) => group.uuid === "CORR-SOIL-DEFORMATION")!.memberSscRefs,
      affectedFragilityRefs: evaluations.filter((evaluation) => evaluation.analysisCategory === "SOIL").map((evaluation) => evaluation.uuid),
      relatedAssumptions: ["Selected profiles bound the final foundation footprint."],
      reasonableAlternatives: ["Equivalent-linear SSI", "Nonlinear soil response", "Alternate liquefaction settlement model"],
      treatment: "Epistemic soil branches are propagated and the alternative deformation model is tested in sensitivity.",
      estimatedCapacityImpact: { lowerFactor: 0.8, upperFactor: 1.17 },
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SFR-E2", "SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-CAPACITY`,
      name: "Component capacity population",
      uncertaintyType: "PARAMETER_EPISTEMIC",
      description: "Test population, material properties, configuration similarity, and scale factors affect median capacity.",
      affectedSscRefs: allSscRefs,
      affectedFragilityRefs: fragilityRefs,
      relatedAssumptions: ["Capacity evidence is representative of the evaluated as-intended configuration."],
      reasonableAlternatives: ["Lower-bound test fit", "Bayesian pooling with applicable experience data"],
      treatment: "Represented by mechanism-specific betaU and evaluated by median-capacity and beta sensitivity studies.",
      estimatedCapacityImpact: { lowerFactor: 0.82, upperFactor: 1.2 },
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SFR-E3", "SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-INSTALLATION`,
      name: "Anchorage and installation condition",
      uncertaintyType: "PARAMETER_EPISTEMIC",
      description: "Anchor preload, embedment, edge distance, support gaps, cable dress, and connected-service configuration affect capacity.",
      affectedSscRefs: allSscRefs,
      affectedFragilityRefs: fragilityRefs,
      relatedAssumptions: ["Final installation remains inside the investigated acceptance criteria."],
      reasonableAlternatives: ["Minimum accepted anchor torque", "Maximum support gap", "Bounding connected-line stiffness"],
      treatment: "Configuration tolerances are included in betaU and remain pre-operational confirmation items.",
      estimatedCapacityImpact: { lowerFactor: 0.86, upperFactor: 1.08 },
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SFR-E3", "SFR-E7"),
    },
    {
      uuid: `UNC-${prefix}-RELAY`,
      name: "Relay chatter transfer",
      uncertaintyType: "MODEL",
      description: "Test-to-installation similarity and cabinet amplification affect contact-chatter capacity.",
      affectedSscRefs: members("RTS-RELAY"),
      affectedFragilityRefs: evaluations.filter((evaluation) => evaluation.analysisCategory === "CONTACT_CHATTER").map((evaluation) => evaluation.uuid),
      relatedAssumptions: ["Relay model, contact state, socket, clip, orientation, and cabinet mounting match the test basis."],
      reasonableAlternatives: ["Plant-specific relay test", "Lower-bound generic chatter envelope"],
      treatment: "Similarity factors and cabinet amplification uncertainty are explicit; unmatched relays remain outside the generic-data justification.",
      estimatedCapacityImpact: { lowerFactor: 0.76, upperFactor: 1.1 },
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SFR-E4", "SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-SOURCES`,
      name: "Flood and fire source failure",
      uncertaintyType: "MODEL",
      description: "Boundary failure, conditional release, ignition, propagation, drainage, and suppression affect source consequences.",
      affectedSscRefs: evaluations.filter((evaluation) => ["FLOOD_SOURCE", "FIRE_SOURCE"].includes(evaluation.analysisCategory)).map((evaluation) => evaluation.sscRef),
      affectedFragilityRefs: evaluations.filter((evaluation) => ["FLOOD_SOURCE", "FIRE_SOURCE"].includes(evaluation.analysisCategory)).map((evaluation) => evaluation.uuid),
      relatedAssumptions: ["Source inventory and mitigation features match the linked fire and flood models."],
      reasonableAlternatives: ["Lower rupture capacity", "Delayed isolation", "Unavailable suppression or drainage"],
      treatment: "Source-capacity and consequence alternatives are evaluated without masking the source fragility.",
      estimatedCapacityImpact: { lowerFactor: 0.78, upperFactor: 1.15 },
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SFR-E5", "SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-CORRELATION`,
      name: "Conditional failure correlation",
      uncertaintyType: "MODEL",
      description: "Common demand, common design, installation similarity, and causal relationships affect joint failures.",
      affectedSscRefs: allSscRefs,
      affectedFragilityRefs: fragilityRefs,
      relatedAssumptions: ["Correlation groups preserve each credible common demand or capacity driver."],
      reasonableAlternatives: ["Independent failures", "Perfectly correlated demand and capacity"],
      treatment: "Partial and causal models are used in the base case; independent and perfect-correlation bounds are quantified.",
      estimatedCapacityImpact: { lowerFactor: 0.95, upperFactor: 1.05 },
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SFR-E6"),
    },
    {
      uuid: `UNC-${prefix}-INTERACTION`,
      name: "Connected-service and spatial interaction",
      uncertaintyType: "MODEL",
      description: "Support stiffness, relative motion, clearances, and local configurations affect interaction demand and failure.",
      affectedSscRefs: members("PRIMARY", "CABLE-TRAYS"),
      affectedFragilityRefs: ["FRAGILITY-PRIMARY", "FRAGILITY-INTERACTION"],
      relatedAssumptions: ["Final gaps and support stiffnesses remain within the analyzed range."],
      reasonableAlternatives: ["Minimum clearance", "Maximum connected-line stiffness", "Unrestrained local interaction"],
      treatment: "Bounding configuration branches are evaluated and tracked to as-built investigation closure.",
      estimatedCapacityImpact: { lowerFactor: 0.84, upperFactor: 1.09 },
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SFR-E1", "SFR-E6", "SFR-E7"),
    },
  ];

  const sensitivities: SensitivityStudy[] = [
    {
      uuid: "SENS-FRAGILITY-BETA",
      name: "Fragility variability",
      description: "Vary randomness and epistemic uncertainty for the leading fragilities.",
      variedParameters: ["betaR", "betaU"],
      parameterRanges: { betaR: [0.2, 0.4], betaU: [0.25, 0.5] },
      results: "Mean seismic frequency changes by -17% to +25%; the leading active SSC remains unchanged.",
      insights: "Lower-tail capacity, not the median alone, controls the risk response.",
      implementsSrs: srs("SFR-E3", "SFR-E6"),
    },
    {
      uuid: "SENS-CORRELATION",
      name: "Failure correlation bounds",
      description: "Replace partial-correlation models with independent and perfect-correlation bounds.",
      variedParameters: ["correlationCoefficient"],
      parameterRanges: { correlationCoefficient: [0, 1] },
      results: "Mean seismic frequency varies by -8% to +14%; common-demand groups drive the upper bound.",
      insights: "Causal cabinet-relay and structure-vessel links must remain explicit.",
      implementsSrs: srs("SFR-E6"),
    },
    {
      uuid: "SENS-DEMAND-SCALE",
      name: "Structural demand scale",
      description: "Vary median local response for model and approximation bias.",
      variedParameters: ["medianDemandScale"],
      parameterRanges: { medianDemandScale: [0.9, 1.12] },
      results: "The seismic result changes by -13% to +19%, with no change in the controlling sequence family.",
      insights: "Active equipment response and structural capacity remain the important demand checks.",
      implementsSrs: srs("SFR-E1", "SFR-E3", "SFR-E6"),
    },
    {
      uuid: "SENS-SOIL-MECHANISM",
      name: "Soil failure alternatives",
      description: "Vary groundwater, liquefaction triggering, settlement, and foundation-distortion models.",
      variedParameters: ["groundwaterDepth", "settlementScale"],
      parameterRanges: { groundwaterDepth: [4.5, 9], settlementScale: [0.7, 1.5] },
      results: kind === "sfr"
        ? "The DHR air-cooler soil fragility changes by -21% to +34% and remains a leading contributor."
        : "The foundation soil fragility changes by -16% to +23% and remains below the active-equipment contribution.",
      insights: "Permanent deformation should remain plant-specific and should not be replaced by a generic SSC fragility.",
      implementsSrs: srs("SFR-E2", "SFR-E6"),
    },
    {
      uuid: "SENS-RELAY-POPULATION",
      name: "Relay test population",
      description: "Use the lower-bound generic chatter envelope and an unmatched-mounting penalty.",
      variedParameters: ["relayCapacityScale"],
      parameterRanges: { relayCapacityScale: [0.72, 1] },
      results: "Relay contribution increases by 11% at the lower-bound capacity but does not become a leading contributor.",
      insights: "The generic-data justification is acceptable only while model, mounting, orientation, and contact-state matches are confirmed.",
      implementsSrs: srs("SFR-E4", "SFR-E6"),
    },
    {
      uuid: "SENS-SOURCE-CAPACITY",
      name: "Flood and fire source capacity",
      description: "Vary source rupture capacity and conditional ignition or release consequence.",
      variedParameters: ["sourceCapacityScale", "conditionalConsequenceScale"],
      parameterRanges: { sourceCapacityScale: [0.75, 1.15], conditionalConsequenceScale: [0.5, 1.5] },
      results: "Combined source contribution remains below 7% of mean seismic frequency across the evaluated range.",
      insights: "Source interfaces remain visible, but no source displaces the active SSCs as the dominant contributors.",
      implementsSrs: srs("SFR-E5", "SFR-E6"),
    },
    {
      uuid: "SENS-CONNECTED-LINE",
      name: "Connected-line flexibility",
      description: "Vary support gaps and connected-line stiffness at equipment and flood-source interfaces.",
      variedParameters: ["supportGap", "lineStiffnessScale"],
      parameterRanges: { supportGap: [0.5, 1.5], lineStiffnessScale: [0.7, 1.4] },
      results: "The primary active SSC HCLPF changes by -9% to +6%; the service-water source remains screened.",
      insights: "Final support gaps are important configuration-control checks.",
      implementsSrs: srs("SFR-E1", "SFR-E5", "SFR-E6", "SFR-E7"),
    },
    {
      uuid: "SENS-INTERACTION-CLEARANCE",
      name: "Spatial-interaction clearance",
      description: "Vary the nonstandard cable-tray clearance and restraint condition.",
      variedParameters: ["clearanceScale", "restraintCapacityScale"],
      parameterRanges: { clearanceScale: [0.6, 1.25], restraintCapacityScale: [0.8, 1.15] },
      results: "The localized interaction remains below 2% of mean seismic frequency when the acceptance criterion is met.",
      insights: "The final walkdown should close the configuration; otherwise the interaction remains explicit.",
      implementsSrs: srs("SFR-E1", "SFR-E6", "SFR-E7"),
    },
  ];

  sfr.results = {
    failureMechanisms: mechanisms,
    fragilityEvaluations: evaluations,
    correlationGroups,
    floodSourceFragilityRefs: evaluations
      .filter((evaluation) => evaluation.analysisCategory === "FLOOD_SOURCE")
      .map((evaluation) => evaluation.uuid),
    fireSourceFragilityRefs: evaluations
      .filter((evaluation) => evaluation.analysisCategory === "FIRE_SOURCE")
      .map((evaluation) => evaluation.uuid),
    contactChatterFragilityRefs: evaluations
      .filter((evaluation) => evaluation.analysisCategory === "CONTACT_CHATTER")
      .map((evaluation) => evaluation.uuid),
    soilFragilityRefs: evaluations
      .filter((evaluation) => evaluation.analysisCategory === "SOIL")
      .map((evaluation) => evaluation.uuid),
    uncertainties,
    sensitivityStudies: sensitivities,
    systemsModelTransferBasis: "Each fragility transfers by controlled SEL item, systems failure mode, hazard parameter, control point, response result, correlation group, and basic event. Active failure modes retain explicit curves; threshold confirmations and specialized flood, fire, relay, soil, and interaction evaluations remain traceable without creating duplicate plant-model events.",
    implementsSrs: srs(
      "SFR-E1",
      "SFR-E2",
      "SFR-E3",
      "SFR-E4",
      "SFR-E5",
      "SFR-E6",
      "SFR-E7",
    ),
  };

  sfr.scope.correlationGroupRefs = correlationGroups.map((group) => group.uuid);
  sfr.documentation.failureMechanismIdentification = "Systems failure modes, investigation findings, structural and geotechnical response, connected services, anchorage, internal assemblies, contact chatter, flood sources, fire sources, and spatial interactions are reconciled to one controlling realistic mechanism per evaluation.";
  sfr.documentation.capacityEvaluationMethods = "Plant-specific calculations and tests are preferred for risk-significant SSCs. Generic or experience data are used only with configuration-specific applicability, lower-tail uncertainty, masking, and risk-impact justification.";
  sfr.documentation.fragilityParameterResults = `${evaluations.length} evaluations provide median capacity, betaR, betaU, composite beta, HCLPF, a 25-point mean curve, and 5th-, 50th-, and 95th-fractile conditional failure curves.`;
  sfr.documentation.engineeringJudgments = "Engineering judgment is limited to documented applicability, correlation, configuration, and model-choice decisions and is tested through reasonable alternatives.";
  sfr.documentation.modelUncertaintiesAndAlternatives = `${uncertainties.length} uncertainty sources and ${sensitivities.length} sensitivity studies cover demand, soil, capacity, installation, relay transfer, fire/flood sources, correlation, and interactions.`;
  sfr.documentation.dataAndCalculationRefs = Array.from(new Set(
    evaluations.flatMap((evaluation) => [
      ...evaluation.responseResultRefs,
      ...evaluation.capacityDataRefs,
    ]),
  ));
  sfr.documentation.traceability = evaluations.map((evaluation) => ({
    sscRef: evaluation.sscRef,
    failureModeRef: evaluation.systemsFailureModeRef,
    mechanismRefs: evaluation.mechanismRefs,
    demandRefs: evaluation.responseResultRefs,
    fragilityRef: evaluation.uuid,
    plantResponseModelRefs: [`BE-${evaluation.sscRef}`],
  }));
  sfr.documentation.implementsSrs = srs("SFR-F1", "SFR-F2", "SFR-F3");
}

export { populateFragilityResults };
