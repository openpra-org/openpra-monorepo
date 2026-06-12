import {
  type MechanisticSourceTermAnalysis,
  type ReleaseCategory,
  type SourceInventory,
  type TransportBarrierAssessment,
  type TransportPhenomenaAssessment,
  type SourceTermDefinition,
  type SourceTermModel,
  type MsUncertaintyAnalysis,
  type MsModelUncertaintyAssessment,
  type MsDocumentation,
  ReleaseForm,
  TransportPhenomenonType,
  MS_SR_CATALOG,
} from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-05-28T12:00:00.000Z";
const CREATED = "2026-05-23T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["MS-A3"]);

const SR_EVIDENCE: Record<string, string> = {
  "MS-A1": "The three release categories carry the seven source-term attributes the consequence analysis needs.",
  "MS-A2": "Every event sequence family maps to one category, and no family is left unassigned.",
  "MS-A3": "The early-release grouping that holds ESF-1 and ESF-4 together still needs the CC-II split shown.",
  "MS-A4": "Each category carries a justified release-termination time, with revaporization checked.",
  "MS-A5": "Each category carries a bounding sequence with its justification.",
  "MS-B1": "Three source inventories are built, two plant-specific and one generic.",
  "MS-B2": "Three barriers from the source to the environment are identified for the bounding category.",
  "MS-B5": "Twelve phenomena are addressed, with the design-unique sodium physics included by name.",
  "MS-B7": "The barrier retention rests on design analyses, logged as a pre-operational assumption.",
  "MS-C3": "The plant-specific calculation is performed for both risk-significant categories.",
  "MS-C5": "Three validated codes run within their applicability limits.",
  "MS-C7": "The inventories use design values, logged as a pre-operational assumption.",
  "MS-D3": "Three model-uncertainty sources are assessed for their consequence effects.",
  "MS-D4": "The component distributions are propagated with the phenomena dependencies for the risk-significant categories.",
  "MS-E2": "The quantitative source-term table is provided for each category by species, phase and form.",
  "MS-E4": "The pre-operational assumptions are documented against the barrier and source-term requirements.",
};

function pathForHlr(hlr: HlrId): string {
  if (hlr === "A") return "releaseCategories";
  if (hlr === "B") return "transportBarrierAssessments";
  if (hlr === "C") return "sourceTermDefinitions";
  if (hlr === "D") return "uncertaintyAnalyses";
  return "documentation";
}

const conformanceMatrix: SRConformance[] = Object.keys(MS_SR_CATALOG).flatMap((code) => {
  const meta = MS_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const stages: PlantStage[] = meta.stages;
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the mechanistic source term analysis.";
  const hlr = meta.hlr;
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr,
    capabilityCategory,
    applicableToStage: stages,
    status,
    satisfiedByElementPaths: [pathForHlr(hlr)],
    evidence,
  }));
});

const releaseCategories: ReleaseCategory[] = [
  {
    uuid: "RC-1",
    name: "Intact functional containment",
    description: "All radionuclide barriers stay intact, so only routine coolant activity escapes.",
    technicalBasis: "Bounded by the sequences that reach a stable cooled state with every barrier holding.",
    supportingReferences: ["ESF-2", "ESF-5"],
    groupingJustification: "The intact sequences share the end state and the negligible release, so one coarse bin suffices.",
    differentiationBasis: "CONSEQUENCE_METRIC",
    timingClassification: "Late",
    magnitudeClassification: "Negligible",
    boundingSequenceReference: "ESF-2",
    boundingSequenceJustification: "The protected flow-loss sequence bounds the release with all barriers intact.",
    releaseTerminationTime: { value: 24, unit: "h", justification: "The plant reaches a stable cooled state and no further release pathway opens." },
    implementsSrs: srs("MS-A1", "MS-A3", "MS-A4", "MS-A5"),
  },
  {
    uuid: "RC-2",
    name: "Delayed filtered release",
    description: "A primary boundary leak is scrubbed by the sodium pool and the building before a delayed release.",
    technicalBasis: "Bounded by the boundary-leak sequence where the pool and the building retain most of the aerosol.",
    supportingReferences: ["ESF-3"],
    groupingJustification: "The boundary-leak family carries its own bin, since the delayed timing differentiates the consequence.",
    differentiationBasis: "CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION",
    timingClassification: "Delayed",
    magnitudeClassification: "Low",
    boundingSequenceReference: "ESF-3",
    boundingSequenceJustification: "The boundary-leak sequence bounds the delayed release through the building pathway.",
    releaseTerminationTime: { value: 48, unit: "h", justification: "The leak is isolated and the aerosol settles, with revaporization checked and found not to reopen the release." },
    implementsSrs: srs("MS-A1", "MS-A3", "MS-A4", "MS-A5"),
  },
  {
    uuid: "RC-3",
    name: "Early release, degraded retention",
    description: "Decay-heat removal is lost and the cell liner and confinement degrade, so an earlier release occurs.",
    technicalBasis: "Bounded by the loss-of-decay-heat sequence where the slow heat-up degrades two barriers.",
    supportingReferences: ["ESF-1", "ESF-4"],
    groupingJustification: "The early-release grouping holds ESF-1 and ESF-4 together. The fine grouping at CC-II that separates ESF-1 from ESF-4 is under review.",
    differentiationBasis: "CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION",
    timingClassification: "Early",
    magnitudeClassification: "Moderate",
    boundingSequenceReference: "ESF-1",
    boundingSequenceJustification: "The loss-of-decay-heat sequence bounds the early release across this category.",
    releaseTerminationTime: { value: 72, unit: "h", justification: "The release is tracked through the slow heat-up, including revaporization of the deposited material." },
    implementsSrs: srs("MS-A1", "MS-A3", "MS-A4", "MS-A5"),
  },
];

const sourceInventories: SourceInventory[] = [
  {
    uuid: "SRC-1",
    name: "Reactor core, metallic fuel",
    radioactiveSourceRef: "SRC-CORE",
    description: "The metallic-fuel core inventory at the end of the equilibrium cycle.",
    calculationBasis: "PLANT_SPECIFIC_CALCULATION",
    inventory: [
      { radionuclide: "Xe-133", quantity: 4.1e18, unit: "Bq", physicalForm: ReleaseForm.ELEMENTAL, chemicalForm: "Noble gas" },
      { radionuclide: "I-131", quantity: 2.3e18, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Sodium iodide" },
      { radionuclide: "Cs-137", quantity: 1.8e17, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Cesium" },
      { radionuclide: "Cs-134", quantity: 1.2e17, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Cesium" },
      { radionuclide: "Te-132", quantity: 1.5e18, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Telluride" },
      { radionuclide: "Sr-90", quantity: 9.0e16, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Strontium oxide" },
    ],
    inventoryDataSource: "Isotopic depletion calculation at the end of the equilibrium cycle.",
    radionuclideSelectionBasis: "The dose-significant species are selected across the noble gases, halogens, alkali metals and refractories.",
    implementsSrs: srs("MS-B1"),
  },
  {
    uuid: "SRC-2",
    name: "Primary sodium and cover gas",
    radioactiveSourceRef: "SRC-NA",
    description: "The activated sodium and the dissolved fission products in the primary coolant and the cover gas.",
    calculationBasis: "PLANT_SPECIFIC_CALCULATION",
    inventory: [
      { radionuclide: "Na-24", quantity: 6.0e16, unit: "Bq", physicalForm: ReleaseForm.ELEMENTAL, chemicalForm: "Sodium activation" },
      { radionuclide: "Na-22", quantity: 2.0e14, unit: "Bq", physicalForm: ReleaseForm.ELEMENTAL, chemicalForm: "Sodium activation" },
      { radionuclide: "Cs-137", quantity: 4.0e15, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Dissolved cesium" },
      { radionuclide: "Ar-41", quantity: 8.0e14, unit: "Bq", physicalForm: ReleaseForm.ELEMENTAL, chemicalForm: "Cover-gas activation" },
    ],
    inventoryDataSource: "Activation calculation for the sodium and the cover-gas equilibrium inventory.",
    radionuclideSelectionBasis: "The activation products and the soluble fission products carried by the sodium are selected.",
    implementsSrs: srs("MS-B1"),
  },
  {
    uuid: "SRC-3",
    name: "In-vessel fuel handling",
    radioactiveSourceRef: "SRC-IVS",
    description: "The decayed inventory of the fuel held in the in-vessel storage position.",
    calculationBasis: "GENERIC_ESTIMATE",
    inventory: [
      { radionuclide: "Cs-137", quantity: 3.0e16, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Cesium" },
      { radionuclide: "Sr-90", quantity: 2.0e16, unit: "Bq", physicalForm: ReleaseForm.AEROSOL, chemicalForm: "Strontium oxide" },
    ],
    inventoryDataSource: "Generic decayed-inventory estimate scaled to the storage loading.",
    radionuclideSelectionBasis: "The long-lived species that survive the decay period are selected.",
    implementsSrs: srs("MS-B1"),
  },
];

const transportBarrierAssessments: TransportBarrierAssessment[] = [
  {
    uuid: "BAR-1",
    name: "Metallic fuel matrix and cladding",
    releaseCategoryReference: "RC-3",
    sourceInventoryRefs: ["SRC-1"],
    description: "The first barrier, the metallic fuel and its cladding, evaluated for the loss-of-decay-heat category.",
    barrierType: "Fuel matrix and cladding",
    failureModes: ["Cladding breach releasing the gap activity", "Fuel relocation releasing the bound inventory"],
    transportCharacteristics: [
      {
        description: "The metallic fuel holds the refractory species, and the cladding breach releases the gap activity first.",
        affectedRadionuclides: ["Xe-133", "I-131", "Cs-137"],
        retentionEffectiveness: "High for the refractory species, low for the noble gases.",
      },
    ],
    physicalChemicalConditions: {
      temperature: "Elevated during the slow heat-up",
      chemicalEnvironment: "Metallic-fuel chemistry binds the cesium until relocation",
      impactOnTransport: "The retention falls as the cladding breaches and the fuel relocates.",
    },
    transportMechanisms: [
      { mechanismType: TransportPhenomenonType.INVENTORY_RELOCATION, description: "Fuel relocation during the heat-up.", significance: ImportanceLevel.HIGH },
      { mechanismType: TransportPhenomenonType.SOLID_TRANSPORT, description: "Solid transport of the relocated material.", significance: ImportanceLevel.MEDIUM },
    ],
    implementsSrs: srs("MS-B2", "MS-B3", "MS-B4"),
  },
  {
    uuid: "BAR-2",
    name: "Primary boundary and sodium pool",
    releaseCategoryReference: "RC-3",
    sourceInventoryRefs: ["SRC-1", "SRC-2"],
    description: "The coolant boundary and the sodium pool, the dominant retention step for the aerosols.",
    barrierType: "Coolant boundary and pool",
    failureModes: ["Boundary leak past the guard vessel", "Cover-gas blowdown carrying the noble gases"],
    transportCharacteristics: [
      {
        description: "The sodium pool scrubs the aerosols strongly, and the cover gas vents the noble gases.",
        affectedRadionuclides: ["I-131", "Cs-137", "Te-132"],
        retentionEffectiveness: "Strong aerosol scrubbing across the pool, weak for the noble gases.",
      },
    ],
    physicalChemicalConditions: {
      temperature: "Pool temperature during the transient",
      chemicalEnvironment: "Sodium chemistry binds the iodine and the cesium",
      impactOnTransport: "The pool scrubbing is the dominant retention step for the aerosols.",
    },
    transportMechanisms: [
      { mechanismType: TransportPhenomenonType.DEPOSITION, description: "Pool scrubbing of the aerosols.", significance: ImportanceLevel.HIGH },
      { mechanismType: TransportPhenomenonType.GASEOUS_TRANSPORT, description: "Cover-gas blowdown of the noble gases.", significance: ImportanceLevel.MEDIUM },
      { mechanismType: TransportPhenomenonType.CHEMICAL_PHYSICAL_FORM, description: "Sodium chemistry binding the iodine.", significance: ImportanceLevel.MEDIUM },
    ],
    implementsSrs: srs("MS-B2", "MS-B3", "MS-B4"),
  },
  {
    uuid: "BAR-3",
    name: "Reactor building, functional containment",
    releaseCategoryReference: "RC-3",
    sourceInventoryRefs: ["SRC-1", "SRC-2"],
    description: "The functional containment, with the retention degraded by the heat-up in this category.",
    barrierType: "Functional containment",
    failureModes: ["Confinement bypass on the degraded pathway", "Penetration seal leak"],
    transportCharacteristics: [
      {
        description: "The building retains material by plate-out and settling, with the retention degraded in this category.",
        affectedRadionuclides: ["Cs-137", "Te-132", "Sr-90"],
        retentionEffectiveness: "Moderate by plate-out and settling, degraded by the heat-up in this category.",
      },
    ],
    physicalChemicalConditions: {
      temperature: "Cell temperature during the heat-up",
      chemicalEnvironment: "Aerosol plate-out on the cool surfaces",
      impactOnTransport: "The degraded confinement raises the fraction that passes in the early-release category.",
    },
    transportMechanisms: [
      { mechanismType: TransportPhenomenonType.DEPOSITION, description: "Plate-out and gravitational settling.", significance: ImportanceLevel.MEDIUM },
      { mechanismType: TransportPhenomenonType.RESUSPENSION, description: "Resuspension on a later disturbance.", significance: ImportanceLevel.LOW },
    ],
    implementsSrs: srs("MS-B2", "MS-B3", "MS-B4"),
  },
];

const transportPhenomenaAssessments: TransportPhenomenaAssessment[] = [
  {
    uuid: "TPA-1",
    releaseCategoryReference: "RC-3",
    phenomenaChecklist: [
      { phenomenonType: TransportPhenomenonType.HEAT_GENERATION, included: true, justification: "The decay heat and the sodium-air reaction exotherm are included." },
      { phenomenonType: TransportPhenomenonType.HEAT_REMOVAL, included: true, justification: "The thermal radiation and the passive heat path are included." },
      { phenomenonType: TransportPhenomenonType.GASEOUS_TRANSPORT, included: true, justification: "The noble-gas blowdown and the buoyant transport are included." },
      { phenomenonType: TransportPhenomenonType.SOLID_TRANSPORT, included: true, justification: "The aerosol transport by diffusion, gravity and liftoff is included." },
      { phenomenonType: TransportPhenomenonType.INVENTORY_RELOCATION, included: true, justification: "The fuel relocation during the heat-up is included." },
      { phenomenonType: TransportPhenomenonType.CHEMICAL_PHYSICAL_FORM, included: true, justification: "The aerosol formation and the elemental iodine fraction are included." },
      { phenomenonType: TransportPhenomenonType.DEPOSITION, included: true, justification: "The pool scrubbing, the plate-out and the gravitational settling are included." },
      { phenomenonType: TransportPhenomenonType.RESUSPENSION, included: true, justification: "The resuspension of the settled material on a later disturbance is included." },
      { phenomenonType: TransportPhenomenonType.RADIONUCLIDE_DECAY_AND_BUILDUP, included: true, justification: "The decay and the daughter buildup during transport are included, since the source term changes as it travels." },
      { phenomenonType: TransportPhenomenonType.EXPLOSION_EFFECTS, included: true, justification: "The explosion effects on the barriers are assessed and found to be low for this design." },
      { phenomenonType: TransportPhenomenonType.DESIGN_UNIQUE, included: true, justification: "The sodium-air reaction aerosol and the sodium-concrete interaction are included by name." },
      { phenomenonType: TransportPhenomenonType.OTHER, included: false, justification: "No additional phenomenon is identified beyond the listed set." },
    ],
    designUniquePhenomena: ["Sodium-air reaction aerosol generation", "Sodium-concrete interaction gas release"],
    modelsUsed: ["Mechanistic transport code", "Aerosol dynamics code", "Release-timing and thermal-energy calculation"],
    relatedBarrierAssessmentRefs: ["BAR-1", "BAR-2", "BAR-3"],
    consequenceQuantificationSupport: {
      description: "The phenomena treatment supports the consequence metric and discriminates the risk-significant differences between families.",
      adequacyJustification: "The treatment is sufficient to determine the risk-significant differences between the event sequence families.",
      sufficientForRiskSignificantDifferentiation: true,
    },
    implementsSrs: srs("MS-B5", "MS-C4"),
  },
];

const sourceTermDefinitions: SourceTermDefinition[] = [
  {
    uuid: "ST-3",
    releaseCategoryReference: "RC-3",
    sourceTermBasis: "PLANT_SPECIFIC_MECHANISTIC",
    riskSignificantCategoryCalculationConfirmed: true,
    releasePhases: [
      { uuid: "p1", name: "Early puff", startTime: 0, endTime: 6, timeUnit: "h" },
      { uuid: "p2", name: "Long-term", startTime: 6, endTime: 72, timeUnit: "h" },
    ],
    radionuclideReleases: [
      {
        phaseId: "p1",
        quantities: [
          { radionuclide: "Xe-133", quantity: 6.0e-1, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "I-131", quantity: 2.5e-2, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Cs-137", quantity: 1.8e-2, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Te-132", quantity: 1.2e-2, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Sr-90", quantity: 3.0e-4, unit: "fraction", expressedAsReleaseFraction: true },
        ],
      },
      {
        phaseId: "p2",
        quantities: [
          { radionuclide: "Xe-133", quantity: 2.0e-1, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "I-131", quantity: 1.5e-2, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Cs-137", quantity: 1.2e-2, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Te-132", quantity: 8.0e-3, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Sr-90", quantity: 2.0e-4, unit: "fraction", expressedAsReleaseFraction: true },
        ],
      },
    ],
    releaseForms: [
      { radionuclide: "Xe-133", form: ReleaseForm.ELEMENTAL },
      { radionuclide: "I-131", form: ReleaseForm.AEROSOL },
      { radionuclide: "Cs-137", form: ReleaseForm.AEROSOL },
      { radionuclide: "Te-132", form: ReleaseForm.AEROSOL },
      { radionuclide: "Sr-90", form: ReleaseForm.AEROSOL },
    ],
    particleSizeDistribution: {
      description: "The aerosol is centered near 1 micron AMAD with a spread to 5 microns.",
      sizeRanges: [{ min: 0.5, max: 5, unit: "micron AMAD", fraction: 1.0 }],
    },
    warningTimeForEvacuation: "About 4 hours of warning before the release begins.",
    releaseEnergy: { quantity: 2.0, unit: "MW thermal" },
    releaseElevation: { quantity: 10, unit: "m, ground level" },
    sourceTermModelRefs: ["MOD-1"],
    implementsSrs: srs("MS-C1", "MS-C3", "MS-C4", "MS-E2"),
  },
  {
    uuid: "ST-2",
    releaseCategoryReference: "RC-2",
    sourceTermBasis: "PLANT_SPECIFIC_MECHANISTIC",
    riskSignificantCategoryCalculationConfirmed: true,
    releasePhases: [{ uuid: "p1", name: "Delayed", startTime: 8, endTime: 48, timeUnit: "h" }],
    radionuclideReleases: [
      {
        phaseId: "p1",
        quantities: [
          { radionuclide: "Xe-133", quantity: 1.0e-1, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "I-131", quantity: 3.0e-3, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Cs-137", quantity: 2.0e-3, unit: "fraction", expressedAsReleaseFraction: true },
          { radionuclide: "Te-132", quantity: 1.5e-3, unit: "fraction", expressedAsReleaseFraction: true },
        ],
      },
    ],
    releaseForms: [
      { radionuclide: "Xe-133", form: ReleaseForm.ELEMENTAL },
      { radionuclide: "I-131", form: ReleaseForm.AEROSOL },
      { radionuclide: "Cs-137", form: ReleaseForm.AEROSOL },
      { radionuclide: "Te-132", form: ReleaseForm.AEROSOL },
    ],
    particleSizeDistribution: {
      description: "The aerosol settles to a sub-micron mode after the pool scrubbing.",
      sizeRanges: [{ min: 0.1, max: 1, unit: "micron AMAD", fraction: 1.0 }],
    },
    warningTimeForEvacuation: "About 8 hours of warning before the delayed release.",
    releaseEnergy: { quantity: 0.4, unit: "MW thermal" },
    releaseElevation: { quantity: 10, unit: "m, ground level" },
    sourceTermModelRefs: ["MOD-1"],
    implementsSrs: srs("MS-C1", "MS-C3", "MS-C4", "MS-E2"),
  },
  {
    uuid: "ST-1",
    releaseCategoryReference: "RC-1",
    sourceTermBasis: "GENERIC_APPLICABLE",
    genericApplicabilityJustification: "An applicable generic noble-gas source term bounds the intact-containment release.",
    postProcessingModifications: ["Scaled to the Generic-1 cover-gas inventory", "Decayed to the termination time"],
    riskSignificantCategoryCalculationConfirmed: false,
    releasePhases: [{ uuid: "p1", name: "Routine", startTime: 0, endTime: 24, timeUnit: "h" }],
    radionuclideReleases: [
      {
        phaseId: "p1",
        quantities: [{ radionuclide: "Xe-133", quantity: 1.0e-6, unit: "fraction", expressedAsReleaseFraction: true }],
      },
    ],
    releaseForms: [{ radionuclide: "Xe-133", form: ReleaseForm.ELEMENTAL }],
    particleSizeDistribution: {
      description: "No aerosol release, the term is noble-gas only.",
      sizeRanges: [],
    },
    warningTimeForEvacuation: "The release stays below the protective-action threshold.",
    releaseEnergy: { quantity: 0.0, unit: "MW thermal" },
    releaseElevation: { quantity: 10, unit: "m, ground level" },
    sourceTermModelRefs: ["MOD-3"],
    implementsSrs: srs("MS-C1", "MS-C2", "MS-E2"),
  },
];

const sourceTermModels: SourceTermModel[] = [
  {
    uuid: "MOD-1",
    name: "Mechanistic transport code",
    version: "3.2",
    technicalBasis: "Solves the transport from each source through the barriers to the environment",
    validationStatus: "Validated",
    verificationValidationProcess: "Validated under an accepted process against separate-effect and integral tests.",
    applicabilityLimits: ["Applicable to sodium-pool and cover-gas geometries", "The aerosol model is bounded to the tested size range"],
    similarClassApplicationEvaluation: "Evaluated qualitatively against similar sodium-facility applications.",
    implementsSrs: srs("MS-C5"),
  },
  {
    uuid: "MOD-2",
    name: "Aerosol dynamics code",
    version: "2.6",
    technicalBasis: "Calculates the aerosol agglomeration, the deposition and the resuspension",
    validationStatus: "Validated",
    verificationValidationProcess: "Validated against aerosol-test data within the tested concentration range.",
    applicabilityLimits: ["The particle-size range is bounded by the validation data"],
    similarClassApplicationEvaluation: "Evaluated against the aerosol behavior in comparable pool systems.",
    implementsSrs: srs("MS-C5"),
  },
  {
    uuid: "MOD-3",
    name: "Depletion and decay code",
    version: "5.1",
    technicalBasis: "Builds the inventory and calculates the decay and the daughter buildup",
    validationStatus: "Verified and validated",
    verificationValidationProcess: "Verified against benchmark depletion cases under the software quality process.",
    applicabilityLimits: ["Applicable to the metallic-fuel composition and the burnup range"],
    similarClassApplicationEvaluation: "Widely applied to fast-reactor fuel cycles.",
    implementsSrs: srs("MS-C5"),
  },
];

const uncertaintyAnalyses: MsUncertaintyAnalysis[] = [
  {
    uuid: "UA-3",
    propagationMethod: "MONTE_CARLO",
    numberOfSamples: 10000,
    modelUncertainties: [
      { uncertaintyId: "MU-1", description: "Pool scrubbing decontamination factor model", impact: "Drives the spread of the aerosol release fraction.", isQuantified: true, treatmentApproach: "Propagated with the phenomena dependencies." },
      { uncertaintyId: "MU-2", description: "Sodium-air reaction aerosol source model", impact: "Combines with the cell temperature to raise the airborne load.", isQuantified: true, treatmentApproach: "Propagated with the phenomena dependencies." },
    ],
    releaseCategoryReference: "RC-3",
    sourceTermDefinitionRef: "ST-3",
    uncertainInputParameters: [
      { parameter: "Pool scrubbing decontamination factor", description: "The aerosol retention across the sodium pool." },
      { parameter: "Confinement plate-out fraction", description: "The fraction deposited on the building surfaces." },
      { parameter: "Sodium-air reaction aerosol source", description: "The aerosol added by the sodium fire." },
    ],
    componentEstimates: [
      { component: "Cs-137 release fraction", valueType: "MEAN", isRiskSignificantFamily: true, probabilisticRepresentationProvided: true, distribution: { type: DistributionType.LOGNORMAL, median: 3.0e-2, errorFactor: 2.7 } },
      { component: "I-131 release fraction", valueType: "MEAN", isRiskSignificantFamily: true, probabilisticRepresentationProvided: true, distribution: { type: DistributionType.LOGNORMAL, median: 4.0e-2, errorFactor: 2.4 } },
    ],
    expertJudgmentUsed: true,
    expertJudgmentProcessSatisfied: true,
    characterizationLevel: "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES",
    phenomenaDependencies: [
      { description: "The aerosol agglomeration and the pool scrubbing are correlated through the particle size.", dependentPhenomena: ["Aerosol agglomeration", "Pool scrubbing"], treatmentMethod: "Sampled together so the particle size moves both." },
      { description: "The sodium-air reaction heat and the confinement plate-out are correlated through the cell temperature.", dependentPhenomena: ["Sodium-air reaction heat", "Plate-out fraction"], treatmentMethod: "Sampled together so the temperature moves both." },
    ],
    uncertaintyPropagationResults: {
      description: "Monte Carlo propagation of the component distributions with the phenomena dependencies.",
      resultSummary: "The Cs-137 release fraction spans about a factor of seven across the propagated distribution.",
      confidenceIntervals: [{ level: 90, lowerBound: 1.1e-2, upperBound: 8.0e-2 }],
    },
    implementsSrs: srs("MS-D1", "MS-D2", "MS-D4"),
  },
  {
    uuid: "UA-2",
    propagationMethod: "MONTE_CARLO",
    numberOfSamples: 10000,
    modelUncertainties: [
      { uncertaintyId: "MU-1", description: "Pool scrubbing decontamination factor model", impact: "Drives the spread of the aerosol release fraction.", isQuantified: true, treatmentApproach: "Propagated with the phenomena dependencies." },
    ],
    releaseCategoryReference: "RC-2",
    sourceTermDefinitionRef: "ST-2",
    uncertainInputParameters: [
      { parameter: "Pool scrubbing decontamination factor", description: "The aerosol retention across the sodium pool." },
      { parameter: "Building filtration efficiency", description: "The retention of the building filtration path." },
    ],
    componentEstimates: [
      { component: "Cs-137 release fraction", valueType: "MEAN", isRiskSignificantFamily: true, probabilisticRepresentationProvided: true, distribution: { type: DistributionType.LOGNORMAL, median: 2.0e-3, errorFactor: 2.9 } },
    ],
    expertJudgmentUsed: false,
    characterizationLevel: "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES",
    phenomenaDependencies: [
      { description: "The pool scrubbing and the building filtration are correlated through the aerosol size leaving the pool.", dependentPhenomena: ["Pool scrubbing", "Building filtration"], treatmentMethod: "Sampled together so the carried size moves both." },
    ],
    uncertaintyPropagationResults: {
      description: "Monte Carlo propagation of the component distributions with the phenomena dependencies.",
      resultSummary: "The Cs-137 release fraction stays below the moderate-release threshold across the distribution.",
      confidenceIntervals: [{ level: 90, lowerBound: 7.0e-4, upperBound: 6.0e-3 }],
    },
    implementsSrs: srs("MS-D1", "MS-D2", "MS-D4"),
  },
  {
    uuid: "UA-1",
    propagationMethod: "ANALYTICAL",
    modelUncertainties: [
      { uncertaintyId: "MU-3", description: "Cover-gas leak rate characterization", impact: "Bounds the spread of the intact-boundary release.", isQuantified: false, treatmentApproach: "Characterized against the leak-rate range." },
    ],
    releaseCategoryReference: "RC-1",
    sourceTermDefinitionRef: "ST-1",
    uncertainInputParameters: [
      { parameter: "Cover-gas leak rate", description: "The leak rate of the intact boundary." },
    ],
    componentEstimates: [
      { component: "Xe-133 release fraction", valueType: "POINT_ESTIMATE", isRiskSignificantFamily: false, probabilisticRepresentationProvided: false },
    ],
    expertJudgmentUsed: false,
    characterizationLevel: "CHARACTERIZED",
    uncertaintyPropagationResults: {
      description: "Characterized uncertainty for the intact-containment category.",
      resultSummary: "The release stays below the protective-action threshold across the characterized range.",
    },
    implementsSrs: srs("MS-D1", "MS-D2", "MS-D4"),
  },
];

const modelUncertaintyAssessments: MsModelUncertaintyAssessment[] = [
  {
    uuid: "MU-1",
    sourceBlock: "BARRIER_TRANSPORT_ASSESSMENT",
    uncertaintySource: "Pool scrubbing decontamination factor model",
    relatedAssumptions: ["The pool depth and the bubble path follow the design geometry."],
    evaluationType: "QUANTITATIVE",
    evaluationScope: "INDIVIDUAL",
    consequenceEffect: "Drives the spread of the aerosol release fraction.",
    implementsSrs: srs("MS-B6", "MS-D3"),
  },
  {
    uuid: "MU-2",
    sourceBlock: "SOURCE_TERM_CALCULATION",
    uncertaintySource: "Sodium-air reaction aerosol source model",
    relatedAssumptions: ["The cell oxygen inventory bounds the reaction extent."],
    evaluationType: "QUANTITATIVE",
    evaluationScope: "COMBINATION",
    consequenceEffect: "Combines with the cell temperature to raise the airborne load.",
    implementsSrs: srs("MS-C6", "MS-D3"),
  },
  {
    uuid: "MU-3",
    sourceBlock: "SOURCE_TERM_CALCULATION",
    uncertaintySource: "Iodine chemical-form split model",
    relatedAssumptions: ["The sodium chemistry holds most of the iodine as sodium iodide."],
    evaluationType: "QUALITATIVE",
    evaluationScope: "INDIVIDUAL",
    consequenceEffect: "Shifts the elemental and the aerosol iodine balance.",
    implementsSrs: srs("MS-C6", "MS-D3"),
  },
];

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "Pool scrubbing sensitivity", description: "Sweep of the pool decontamination factor.", variedParameters: ["Pool decontamination factor"], parameterRanges: { "Pool decontamination factor": [10, 40] }, results: "Halving the pool decontamination factor raises the Cs-137 release fraction by about a factor of two." },
  { uuid: "SS-2", name: "Particle-size sweep", description: "Sweep of the initial aerosol particle size.", variedParameters: ["Particle size"], parameterRanges: { "Particle size": [0.5, 5] }, results: "A larger initial particle size lowers the airborne fraction through faster settling." },
  { uuid: "SS-3", name: "Termination-time sweep", description: "Sweep of the release-termination time.", variedParameters: ["Termination time"], parameterRanges: { "Termination time": [48, 96] }, results: "Extending the termination time adds a small revaporization contribution to the long-term phase." },
];

const preOperationalAssumptions = [
  { id: "PA-1", area: "Barriers", desc: "The barrier retention rests on design analyses, to confirm against the as-built plant.", path: "transportBarrierAssessments" },
  { id: "PA-2", area: "Source term", desc: "The inventories use design values, to replace with as-built confirmation.", path: "sourceInventories" },
  { id: "PA-3", area: "Documentation", desc: "The source term rests on inherited pre-operational inputs, recorded as limitations.", path: "documentation" },
].map((a) => ({
  uuid: a.id,
  assumptionId: a.id,
  description: a.desc,
  influenceOnDefinition: a.area,
  status: "OPEN" as const,
  limitations: ["Pre-operational, pending as-built and as-operated confirmation."],
  riskImpact: ImportanceLevel.MEDIUM,
  closureBasis: "Confirm against the operating plant.",
  plannedClosureActions: ["Re-check at the operating stage."],
  affectedElementIds: [a.path],
}));

const documentation: MsDocumentation = {
  processDescription: "The release categories are characterized, the barriers and transport phenomena are assessed, and the source term is calculated mechanistically, per ASME/ANS RA-S-1.4 HLR-MS-A through E.",
  inputsDescription: "MS takes the release-category definitions from ES, the radioactive sources and transport barriers from POS, and the risk-significance of each category from ESQ.",
  appliedMethods: "Isotopic depletion for the inventories, control-volume mechanistic transport for the release, aerosol dynamics for the deposition and Monte Carlo for the uncertainty, each one accepted way to do its sub-task.",
  resultsSummary: "Three release categories are characterized, two of them risk-significant with plant-specific mechanistic source terms, and the early-release Cs-137 fraction is 3.0E-2.",
  sourceCharacterizationAndInventories: "Three sources are characterized, the core, the primary sodium with the cover gas, and the in-vessel storage, with plant-specific inventories for the first two.",
  releaseCategoryDefinitionBases: "The categories are defined under ES-C1 and verified here to carry the full source-term attribute set, with bounding sequences and justified termination times.",
  sequenceToReleaseCategoryAssignment: "Every event sequence family maps to one release category, and no family is left unassigned.",
  transportPhenomenaPerCategory: "The twelve-item phenomena checklist is addressed for the bounding category, with the design-unique sodium physics included by name.",
  modelsAndComputerPrograms: "Three validated codes run within their applicability limits, the mechanistic transport code, the aerosol dynamics code and the depletion code.",
  uncertaintyAndSensitivityAnalyses: "The component distributions are propagated with the phenomena dependencies for the risk-significant categories, and three sensitivity studies bound the open questions.",
  surrogateRiskMetrics: "The large-release-frequency surrogate maps to the early-release category, with the relationship documented.",
  sourceTermParameterTables: "The quantitative source-term table is provided for each category by species, phase and form, with the uncertainty carried per component.",
  modelUncertaintySources: "The model-uncertainty sources include the pool scrubbing model, the sodium-air reaction aerosol source and the iodine chemical-form split.",
  asBuiltLimitations: "Pre-operational: the barrier retention and the inventories rest on design analyses and design values pending as-built confirmation.",
  praTaskInterfaces: "MS takes the categories from ES, the inventory from POS and the significance from ESQ, and it delivers the source-term table to the Radiological Consequence analysis, which Risk Integration pairs with the ESQ frequency.",
  implementsSrs: srs("MS-E1", "MS-E2", "MS-E3", "MS-E4"),
};

export const MS_ANALYSIS: MechanisticSourceTermAnalysis = {
  uuid: "ms-generic-1",
  name: "Generic-1 Mechanistic Source Term Analysis",
  type: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS,
  version: "1",
  created: CREATED,
  modified: NOW,
  owner: "nsorensen",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "nsorensen" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["nsorensen", "rmenon", "abensalem"],
    reviewers: [
      { id: "rev-1", name: "Dr. Hossein Ardakani", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Lena Hoffmann", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Event Sequence reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Priya Raman", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Radiological Consequence reviewer", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Mechanistic source term analysis for the Generic-1 sodium-cooled fast reactor, calculating what actually comes out when a release happens, by species, quantity, form, timing, energy and location.",
    limitations: ["Pre-operational: the barrier retention and the inventories rest on design analyses and design values, logged as assumptions."],
    lastModifiedDate: NOW,
    lastModifiedBy: "nsorensen",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "msc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-26T09:14:00.000Z", associatedSr: "MS-A3", text: "The early-release category groups ESF-1 and ESF-4 together, so MS-A3 needs the CC-II split shown to confirm the grouping does not mask a risk-significant difference.", severity: "MAJOR", resolved: false },
      { uuid: "msc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-26T10:30:00.000Z", associatedSr: "MS-B5", text: "The phenomena checklist is complete, but MS-B5 needs the design-unique item shown to cover the sodium-concrete interaction in the categories where the pool contacts the structure.", severity: "MAJOR", resolved: false },
      { uuid: "msc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-27T14:05:00.000Z", associatedSr: "MS-C2", text: "The intact-containment category borrows a generic noble-gas term, so MS-C2 needs the post-processing modifications listed so the applicability is traceable.", severity: "MINOR", resolved: false },
      { uuid: "msc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-27T15:20:00.000Z", associatedSr: "MS-A4", text: "The termination time accounts for revaporization in the early-release category.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the revaporization basis is recorded in the termination-time justification.", resolvedAt: "2026-05-27T16:30:00.000Z", resolvedBy: "rev-2" },
      { uuid: "msc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-27T16:00:00.000Z", associatedSr: "MS-D4", text: "The propagation samples the pool scrubbing and the agglomeration together, so MS-D4 needs the phenomena dependency shown so the correlation is auditable.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope mechanistic source term analysis for the Generic-1 SFR, pre-operational stage, capability category CC-II.",
  releaseCategories,
  releaseCategoryCompletenessAssessment: {
    setReasonablyComplete: true,
    consistencyWithConsequenceAnalysis: "The category set is consistent with the consequence-analysis requirements.",
    basis: "Every event sequence family maps to one category, and no family is left unassigned.",
    implementsSrs: srs("MS-A2"),
  },
  sourceInventories,
  transportBarrierAssessments,
  transportPhenomenaAssessments,
  sourceTermDefinitions,
  sourceTermModels,
  uncertaintyAnalyses,
  modelUncertaintyAssessments,
  sensitivityStudies,
  modelUncertainty: {
    uuid: "ms-mu-1",
    name: "MS model uncertainty documentation",
    uncertaintySources: [
      { source: "Pool scrubbing decontamination factor model", impact: "Drives the spread of the aerosol release fraction." },
      { source: "Sodium-air reaction aerosol source model", impact: "Combines with the cell temperature to raise the airborne load." },
      { source: "Iodine chemical-form split model", impact: "Shifts the elemental and the aerosol iodine balance." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  documentation,
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-082", "NM-085", "NM-088"],
};
