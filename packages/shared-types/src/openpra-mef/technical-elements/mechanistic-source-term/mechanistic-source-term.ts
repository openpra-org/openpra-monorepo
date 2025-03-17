/**
 * @module mechanistic_source_term_analysis
 * @description Comprehensive types and interfaces for Mechanistic Source Term Analysis (MS)
 * 
 * The objectives of Mechanistic Source Term Analysis ensure that:
 * - (a) there is a reasonably complete definition and characterization of release categories for
 *       the requirements of the Mechanistic Source Term Analysis and Radiological Consequence Analysis;
 * - (b) the Mechanistic Source Term Analysis assesses the radionuclide transport barriers and
 *       transport mechanisms for each release category;
 * - (c) the mechanistic source term and associated radionuclide transport phenomena are calculated;
 * - (d) uncertainties in the mechanistic source terms and associated radionuclide transport
 *       phenomena are characterized and quantified when practical;
 * - (e) the documentation of the Mechanistic Source Term Analysis provides traceability of the work.
 * 
 * Per RG 1.247, the objective of the mechanistic source term analysis PRA element is to 
 * characterize the radiological releases to the environment (or source terms) that could result
 * from the event sequences modeled in the PRA.
 * 
 * @preferred
 * @category Technical Elements
 */

import typia, { tags } from "typia";    
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { IdPatterns, ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis } from "../core/shared-patterns";
import { 
    BaseDesignInformation, 
    BaseProcessDocumentation, 
    BaseModelUncertaintyDocumentation, 
    BasePreOperationalAssumptionsDocumentation,
    BasePeerReviewDocumentation,
    BaseTraceabilityDocumentation,
    BaseAssumption,
    PreOperationalAssumption
} from "../core/documentation";
import { BaseEvent, BasicEvent, TopEvent} from "../core/events";
import { EventSequenceReference, SourceTermReference } from "../event-sequence-analysis/event-sequence-analysis";
import { DistributionType } from "../data-analysis/data-analysis";
import { BarrierStatus, RadionuclideBarrier } from "../plant-operating-states-analysis/plant-operating-states-analysis";

//==============================================================================
/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

/**
 * Type for release category IDs.
 * Format: RC-[NAME] (e.g., RC-LER)
 * @group Core Definitions & Enums
 */
export type ReleaseCategoryReference = string & tags.Pattern<"^RC-[A-Za-z0-9_-]+$">;

/**
 * Type for source term IDs.
 * Format: ST-[NUMBER] (e.g., ST-001)
 * @group Core Definitions & Enums
 */
export type SourceTermDefinitionReference = string & tags.Pattern<"^ST-[0-9]+$">;

/**
 * @group Core Definitions & Enums
 * @description Represents the physical and chemical form of a released substance.
 */
export enum ReleaseForm {
  /** Elemental gaseous form */
  ELEMENTAL = "ELEMENTAL",
  
  /** Aerosol particles suspended in air */
  AEROSOL = "AEROSOL",
  
  /** Dust particles */
  DUST = "DUST",
  
  /** Other forms not covered by the standard categories */
  OTHER = "OTHER"
}

/**
 * @group Core Definitions & Enums
 * @description Represents a specific radionuclide isotope.
 * @example "Cs-137"
 */
export type Radionuclide = string;

/**
 * @group Core Definitions & Enums
 * @description Represents a time phase of a release.
 */
export interface ReleasePhase extends Unique {
  /** Name of the release phase */
  name: string;
  
  /** Description of the release phase */
  description?: string;
  
  /** Start time of the phase (e.g., in seconds after the initiating event) */
  startTime: number;
  
  /** End time of the phase */
  endTime: number;
  
  /** Unit of time measurement */
  timeUnit?: string;
}

/**
 * @group Core Definitions & Enums
 * @description Represents the quantity of a specific radionuclide released during a phase.
 */
export interface RadionuclideReleaseQuantity {
  /** Radionuclide isotope */
  radionuclide: Radionuclide;
  
  /** Quantity released (can be a value or a fraction of inventory) */
  quantity: number;
  
  /** Unit of quantity (e.g., "Bq", "Ci", or "fraction") */
  unit: string;
  
  /** Uncertainty in the release quantity, if known */
  uncertainty?: RadionuclideReleaseUncertainty;
}

/**
 * @group Core Definitions & Enums
 * @description Represents the uncertainty associated with a radionuclide release quantity.
 */
export interface RadionuclideReleaseUncertainty {
  /** Type of distribution (e.g., lognormal, uniform) */
  distributionType: DistributionType;
  
  /** Parameters of the distribution */
  parameters: Record<string, number>;
  
  /** Description of the uncertainty */
  description?: string;
}

/**
 * @group Core Definitions & Enums
 * @description The types of transport phenomena that can affect radionuclide release.
 * @implements MS-B5: ASSESS the following phenomena for inclusion in the Mechanistic Source Term Analysis
 */
export enum TransportPhenomenonType {
  /** Barrier degradation or failure */
  BARRIER_FAILURE = "BARRIER_FAILURE",
  
  /** Radionuclide transport through intact barriers */
  BARRIER_LEAKAGE = "BARRIER_LEAKAGE",
  
  /** Physical deposition of radioactive material */
  DEPOSITION = "DEPOSITION",
  
  /** Resuspension of deposited material */
  RESUSPENSION = "RESUSPENSION",
  
  /** Chemical interactions affecting transport and form */
  CHEMICAL_INTERACTION = "CHEMICAL_INTERACTION",
  
  /** General thermal processes affecting transport */
  THERMAL_PROCESS = "THERMAL_PROCESS",
  
  /** General mechanical processes affecting transport (e.g., pressure-driven flow) */
  MECHANICAL_PROCESS = "MECHANICAL_PROCESS",
  
  /** Heat generation from various sources (reactivity additions, decay heat, exothermic reactions, recriticality) */
  HEAT_GENERATION = "HEAT_GENERATION",
  
  /** Heat removal mechanisms (forced convection, natural convection, conduction, thermal radiation, endothermic reactions) */
  HEAT_REMOVAL = "HEAT_REMOVAL",
  
  /** Transport of material in gaseous form (pressure differences, blowdown, expansion, contraction, buoyancy, chemical reaction products) */
  GASEOUS_TRANSPORT = "GASEOUS_TRANSPORT",
  
  /** Transport of material in solid form (diffusion, gravity, steam/water, other liquids, liftoff based on volatility) */
  SOLID_TRANSPORT = "SOLID_TRANSPORT",
  
  /** Physical movement of core or source materials */
  INVENTORY_RELOCATION = "INVENTORY_RELOCATION",
  
  /** Effects of explosions on transport and barriers */
  EXPLOSION_EFFECTS = "EXPLOSION_EFFECTS",
  
  /** Transformation of radionuclides through decay and buildup */
  RADIONUCLIDE_TRANSFORMATION = "RADIONUCLIDE_TRANSFORMATION",
  
  /** Other phenomena not covered by the standard categories */
  OTHER = "OTHER"
}

//==============================================================================
/**
 * @group Release Categorization & Source Characterization
 * @description Release category definitions, radioactive source characterization, and mapping of event sequences
 * @implements HLR-MS-A
 * @implements HLR-MS-B
 */
//==============================================================================

/**
 * @group Release Categorization & Source Characterization
 * @description Defines a single release category for the Mechanistic Source Term Analysis.
 * @implements MS-A1: DEFINE the set of release categories consistent with the Event Sequence Analysis end states and radionuclide transport analysis performed.
 * @example
 * ```typescript
 * const releaseCategory: ReleaseCategory = {
 *   uuid: "rc-001",
 *   name: "Large Early Release",
 *   description: "Significant release of radioactive material early in the event.",
 *   eventSequenceFamilies: ["LOCA-ES-001", "SGTR-ES-002"],
 * };
 * ```
 */
export interface ReleaseCategory extends Unique, Named {
  /** Detailed description of the release category */
  description: string;
  
  /** Event sequence families assigned to this release category */
  eventSequenceFamilies: EventSequenceReference[];
  
  /** Justification for the grouping of sequences into this release category */
  groupingJustification?: string;
  
  /** Timing classification of this release (e.g., early, late) */
  timingClassification?: string;
  
  /** Magnitude classification of this release (e.g., large, small) */
  magnitudeClassification?: string;
  
  /** Bounding sequence representing this release category (MS-A5) */
  boundingSequenceReference?: EventSequenceReference;
  
  /** Justification for the selection of the bounding sequence */
  boundingSequenceJustification?: string;
  
  /** Termination time for radiological releases consideration (MS-A4) */
  releaseTerminationTime?: {
    value: number;
    unit: string;
    justification: string;
  };
  
  /** Consistency with Radiological Consequence Analysis requirements (MS-A2) */
  radiologicalConsequenceConsistency?: {
    description: string;
    justification: string;
  };
  
  /** 
   * Pre-operational assumptions that influence release category definition and characterization
   * @implements MS-A3: IDENTIFY assumptions made due to the lack of as-built and as-operated details
   */
  preOperationalAssumptions?: {
    /** Description of the assumption */
    description: string;
    
    /** How this assumption influences the release category definition or characterization */
    influence: string;
    
    /** Basis or rationale for making this assumption */
    basis?: string;
    
    /** Information needed to validate or refine this assumption during later stages */
    validationNeeded?: string;
  }[];
}

/**
 * @group Release Categorization & Source Characterization
 * @description Characterization of a source of radioactive material.
 * @implements MS-B1: CHARACTERIZE each modeled source of radioactive material and inventory.
 * @example
 * ```typescript
 * const radioactiveSource: RadioactiveSource = {
 *   uuid: "rs-001",
 *   name: "Reactor Core",
 *   description: "The primary source of fission products.",
 *   radionuclides: ["I-131", "Cs-137", "Xe-133"],
 *   totalInventory: { 
 *     "I-131": { quantity: 1.0e17, unit: "Bq" },
 *     "Cs-137": { quantity: 5.0e16, unit: "Bq" },
 *     "Xe-133": { quantity: 8.0e17, unit: "Bq" }
 *   },
 * };
 * ```
 */
export interface RadioactiveSource extends Unique, Named {
  /** Detailed description of the radioactive material source */
  description: string;
  
  /** List of significant radionuclides in this source */
  radionuclides: Radionuclide[];
  
  /** Total inventory of radionuclides in this source */
  totalInventory: Record<Radionuclide, { quantity: number; unit: string }>;
  
  /** Source of the inventory data */
  inventoryDataSource?: string;
  
  /** Basis for the selection of included radionuclides */
  radionuclideSelectionBasis?: string;
  
  /** Uncertainty in the inventory values */
  inventoryUncertainty?: {
    description: string;
    distributionType?: DistributionType;
    parameters?: Record<string, number>;
  };
}

/**
 * @group Release Categorization & Source Characterization
 * @description Maps event sequences to release categories and provides justification.
 * @implements MS-E1(c): DOCUMENT assignment of event sequences and event sequence families to each release category
 * @remarks This interface is referenced by the Risk Integration module's EventSequenceToReleaseCategory interface.
 * The Risk Integration module uses this mapping as input for risk calculations.
 */
export interface EventSequenceToReleaseCategoryMapping extends Unique {
  /** Reference to the event sequence */
  eventSequenceReference: EventSequenceReference;
  
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  
  /** Justification for assigning this event sequence to this release category */
  assignmentJustification: string;
  
  /** Technical basis for the assignment */
  technicalBasis?: string;
  
  /** 
   * Frequency information for this mapping, if available at this stage.
   * This may be populated during event sequence quantification and used by risk integration.
   */
  frequencyInformation?: {
    /** Mean frequency value */
    mean?: number;
    
    /** Frequency unit */
    unit?: string;
    
    /** Uncertainty in the frequency */
    uncertainty?: {
      /** Distribution type */
      distributionType?: DistributionType;
      
      /** Distribution parameters */
      parameters?: Record<string, number>;
    };
  };
  
  /**
   * Flag indicating whether this mapping has been processed by risk integration.
   * Used for traceability between technical elements.
   */
  processedByRiskIntegration?: boolean;
  
  /**
   * Reference to the corresponding mapping in the risk integration module, if available.
   * This provides traceability between the mechanistic source term and risk integration modules.
   */
  riskIntegrationMappingId?: string;
  
  /**
   * Risk significance level determined by risk integration, if available.
   * This may be populated based on feedback from risk integration.
   */
  riskSignificance?: ImportanceLevel;
  
  /**
   * Insights from risk integration, if available.
   * This may be populated based on feedback from risk integration.
   */
  riskIntegrationInsights?: string[];
}

/**
 * @group Release Categorization & Source Characterization
 * @description Technical basis for the adequacy of the definition of a release category.
 * @implements MS-E1(b): DOCUMENT technical basis for the adequacy of the definition of each modeled release category
 */
export interface ReleaseCategoryBasis extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  
  /** Technical basis for the definition of the release category */
  technicalBasis: string;
  
  /** References to supporting analyses or documents */
  supportingReferences?: string[];
  
  /** Description of how this release category aligns with regulatory expectations */
  regulatoryAlignment?: string;
}

//==============================================================================
/**
 * @group Transport Phenomena & Calculation
 * @description Radionuclide transport barriers, mechanisms, and source term calculation
 * @implements HLR-MS-B
 * @implements HLR-MS-C
 */
//==============================================================================

/**
 * @group Transport Phenomena & Calculation
 * @description Represents a barrier to radionuclide transport from a mechanistic source term perspective.
 * This interface focuses on the transport characteristics and effectiveness of barriers,
 * while referencing operational status information from the Plant Operating States module.
 * @implements MS-B2: ASSESS the radionuclide transport barriers
 * @implements MS-B4: ASSESS the relevant radionuclide transport characteristics within each transport barrier
 */
export interface RadionuclideTransportBarrier extends Unique, Named {
  /** Description of the barrier */
  description: string;
  
  /** Type of barrier (e.g., physical, chemical) */
  barrierType: string;
  
  /** Effectiveness of the barrier in retaining radionuclides */
  effectiveness?: string;
  
  /** Conditions under which the barrier may fail or degrade */
  failureConditions?: string[];
  
  /** Radionuclides primarily affected by this barrier */
  affectedRadionuclides?: Radionuclide[];
  
  /** 
   * Reference to a barrier defined in Plant Operating States Analysis.
   * This UUID links to a RadionuclideBarrier in the Plant Operating States module,
   * allowing reuse of operational status information while maintaining separation of concerns.
   */
  barrierReference?: string;
  
  /** 
   * Current status of the barrier in this analysis context.
   * Reuses the BarrierStatus enum from Plant Operating States Analysis for consistency.
   */
  status?: BarrierStatus;
  
  /**
   * Physical and chemical conditions within the barrier that affect radionuclide transport.
   * @implements MS-B4: ASSESS the impact of the physical and chemical conditions within each barrier
   */
  physicalChemicalConditions?: {
    /** Temperature conditions (e.g., range, gradients) */
    temperature?: string;
    
    /** Pressure conditions (e.g., range, gradients) */
    pressure?: string;
    
    /** Flow rate or fluid dynamics information */
    flowRate?: string;
    
    /** Chemical environment (e.g., pH, oxidation state) */
    chemicalEnvironment?: string;
    
    /** Impact assessment of these conditions on radionuclide transport */
    impactOnTransport: string;
  };
  
  /**
   * Transport mechanisms specific to this barrier.
   * @implements MS-B4: ASSESS the relevant radionuclide transport characteristics
   */
  transportMechanisms?: {
    /** Type of transport mechanism */
    mechanismType: TransportPhenomenonType;
    
    /** Description of the mechanism */
    description: string;
    
    /** Significance of this mechanism for this barrier */
    significance: ImportanceLevel;
  }[];
}

/**
 * @group Transport Phenomena & Calculation
 * @description Represents a mechanism for radionuclide transport.
 * @implements MS-B3: ASSESS the transport mechanisms
 */
export interface TransportMechanism extends Unique, Named {
  /** Description of the transport mechanism */
  description: string;
  
  /** Type of transport mechanism */
  mechanismType: string;
  
  /** Conditions that activate or enhance this transport mechanism */
  activatingConditions?: string[];
  
  /** Radionuclides primarily transported by this mechanism */
  affectedRadionuclides?: Radionuclide[];
}

/**
 * @group Transport Phenomena & Calculation
 * @description Details of the radionuclide transport phenomena for a specific release category.
 * @implements MS-C1: IDENTIFY the relevant radionuclide transport phenomena for each release category.
 * @implements MS-B5: ASSESS the following phenomena for inclusion in the Mechanistic Source Term Analysis.
 * @example
 * ```typescript
 * const transportPhenomena: TransportPhenomena = {
 *   uuid: "tp-001",
 *   releaseCategoryReference: "RC-LER",
 *   phenomena: ["Fuel clad failure", "Containment leakage"],
 *   modelsUsed: ["NUREG/CR-XXXX", "Vendor Report YYYY"],
 * };
 * ```
 */
export interface TransportPhenomena extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  
  /** Description of the relevant transport phenomena */
  phenomena: string[];
  
  /** Type classification of each phenomenon */
  phenomenaTypes?: TransportPhenomenonType[];
  
  /** Models and computer programs used to analyze these phenomena */
  modelsUsed: string[];
  
  /** Barriers that affect these transport phenomena */
  relatedBarriers?: string[];
  
  /** Transport mechanisms involved in these phenomena */
  relatedMechanisms?: string[];
  
  /** 
   * Assessment of specific MS-B5 phenomena for inclusion
   * @implements MS-B5: ASSESS the following phenomena for inclusion in the Mechanistic Source Term Analysis
   */
  msB5Assessment?: {
    /** Phenomena assessed and their inclusion status */
    assessedPhenomena: {
      phenomenonType: TransportPhenomenonType;
      included: boolean;
      justification?: string;
    }[];
    
    /** Justification for the overall assessment approach */
    assessmentJustification?: string;
  };
  
  /**
   * Justification that the treatment of phenomena is sufficient to support Consequence Quantification
   * @implements MS-C4: JUSTIFY that the treatment of phenomena is sufficient to support Consequence Quantification
   */
  consequenceQuantificationSupport?: {
    /** Description of how the phenomena treatment supports consequence quantification */
    description: string;
    
    /** Justification for the adequacy of the treatment */
    adequacyJustification: string;
  };
}

/**
 * @group Transport Phenomena & Calculation
 * @description Definition of the source term for a specific release category, detailing the release characteristics.
 * @implements MS-E2: INCLUDE the quantitative values and assessment of uncertainty for the following parameters of the definition of the source term for each modeled release category: (a) number of reactors involved... (b) quantity of radionuclides released... (c) physical and chemical form... (d) source term release timing... (e) warning time for evacuation... (f) energy of the release; (g) elevation of the release.
 * @example
 * ```typescript
 * const sourceTermDefinition: SourceTermDefinition = {
 *   uuid: "std-001",
 *   releaseCategoryReference: "RC-LER",
 *   involvedReactors: 1,
 *   radionuclideReleases: [
 *     {
 *       phase: { uuid: "phase-001", name: "Initial Burst", startTime: 0, endTime: 3600 },
 *       quantities: [{ radionuclide: "I-131", quantity: 0.05, unit: "fraction" }],
 *     },
 *   ],
 *   releaseForm: { "I-131": "ELEMENTAL", "Cs-137": "AEROSOL" },
 *   releaseTiming: [{ uuid: "phase-001", name: "Initial", startTime: 0, endTime: 3600 }],
 *   warningTimeForEvacuation: "2 hours",
 *   releaseEnergy: { quantity: 1.0e6, unit: "Joules" },
 *   releaseElevation: { quantity: 10, unit: "meters" },
 * };
 * ```
 */
export interface SourceTermDefinition extends Unique {
  /** Reference to the release category */
  releaseCategoryReference: ReleaseCategoryReference;
  
  /** Number of reactors or sources involved in this release scenario */
  involvedReactors?: number;
  
  /** Quantity of radionuclides released by species in each time phase */
  radionuclideReleases: {
    phase: ReleasePhase;
    quantities: RadionuclideReleaseQuantity[];
  }[];
  
  /** Physical and chemical form of the release for each species */
  releaseForm: Record<Radionuclide, ReleaseForm | string>;
  
  /** Source term release timing including multiphase releases */
  releaseTiming: ReleasePhase[];
  
  /** Warning time available for evacuation */
  warningTimeForEvacuation?: string;
  
  /** Energy content of the release */
  releaseEnergy?: { quantity: number; unit: string };
  
  /** Elevation of the release point */
  releaseElevation?: { quantity: number; unit: string };
  
  /** Reference to the source term model used for calculation */
  sourceTermModelReference?: string;
  
  /** Aerosol and particle size distribution, if applicable */
  particleSizeDistribution?: {
    description: string;
    sizeRanges: { min: number; max: number; unit: string; fraction: number }[];
  };
}

/**
 * @group Transport Phenomena & Calculation
 * @description Represents the models and computer programs used in the Mechanistic Source Term Analysis.
 * @implements MS-E1(e): DOCUMENT Models and computer programs used to develop source terms.
 * @example
 * ```typescript
 * const sourceTermModel: SourceTermModel = {
 *   uuid: "stm-001",
 *   name: "MELCOR",
 *   version: "2.1",
 *   technicalBasis: "NUREG/CR-XXXX",
 *   validationStatus: "Verified and Validated",
 * };
 * ```
 */
export interface SourceTermModel extends Unique, Named {
  /** Version of the model or program */
  version: string;
  
  /** Technical basis and documentation for the model */
  technicalBasis: string;
  
  /** Status of verification and validation */
  validationStatus: string;
  
  /** Key assumptions in the model */
  keyAssumptions?: string[];
  
  /** Known limitations of the model */
  knownLimitations?: string[];
  
  /** References to documentation or benchmarks */
  references?: string[];
  
  /** Areas where the model is applicable */
  applicableAreas?: string[];
}

//==============================================================================
/**
 * @group Uncertainty & Sensitivity Analysis
 * @description Uncertainty analysis, sensitivity studies, and model uncertainty documentation
 * @implements HLR-MS-D
 */
//==============================================================================

/**
 * @group Uncertainty & Sensitivity Analysis
 * @description Extends the base uncertainty analysis with mechanistic source term specific aspects.
 * @implements MS-D1: IDENTIFY and CHARACTERIZE the uncertainty sources
 */
export interface MechanisticSourceTermUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  /** Reference to the source term or release category being analyzed */
  sourceTermReference?: SourceTermDefinitionReference;
  releaseCategoryReference?: ReleaseCategoryReference;
  
  /** Uncertainties specific to transport phenomena */
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    description: string;
    impact: string;
    distributionType?: DistributionType;
    parameters?: Record<string, number>;
  }[];
  
  /** Uncertainties in release fractions or quantities */
  releaseFractionUncertainties?: {
    radionuclide: Radionuclide;
    description: string;
    distributionType: DistributionType;
    parameters: Record<string, number>;
  }[];
  
  /** Results of uncertainty propagation */
  uncertaintyPropagationResults?: {
    description: string;
    resultSummary: string;
    confidenceIntervals?: { level: number; lowerBound: number; upperBound: number }[];
  };
  
  /**
   * Method used to quantify uncertainty in the estimated source term
   * @implements MS-D2: QUANTIFY the uncertainty in the estimated source term using appropriate methods
   */
  quantificationMethod?: {
    /** Description of the method used */
    methodDescription: string;
    
    /** Justification for selecting this method */
    methodJustification?: string;
  };
  
  /**
   * Documentation of uncertainty and sensitivity analysis results
   * @implements MS-D4: DOCUMENT the results of the uncertainty and sensitivity analyses
   */
  documentationOfResults?: string;
}

/**
 * @group Uncertainty & Sensitivity Analysis
 * @description Sensitivity studies specific to mechanistic source term analysis.
 * @implements MS-D2: IDENTIFY key sources of uncertainty
 * @implements MS-E1(f): DOCUMENT uncertainty and sensitivity analyses for each source term
 */
export interface MechanisticSourceTermSensitivityStudy extends SensitivityStudy {
  /** Reference to the source term or release category being analyzed */
  sourceTermReference?: SourceTermDefinitionReference;
  releaseCategoryReference?: ReleaseCategoryReference;
  
  /** Parameter changed in the sensitivity study */
  parameterChanged: string;
  
  /** Impact on the source term */
  impactOnSourceTerm: string;
  
  /** Whether this parameter is considered a key driver of uncertainty */
  isKeyDriver: boolean;
  
  /** Recommendations based on the sensitivity study */
  recommendations?: string;
  
  /**
   * Evaluation of the impact of key sources of uncertainty on the estimated source term
   * @implements MS-D3: PERFORM sensitivity analyses to evaluate the impact of key sources of uncertainty
   */
  keyUncertaintyImpactEvaluation?: {
    /** Description of the impact evaluation */
    description: string;
    
    /** Significance of the impact */
    significance: ImportanceLevel;
  };
  
  /**
   * Documentation of sensitivity analysis results
   * @implements MS-D4: DOCUMENT the results of the uncertainty and sensitivity analyses
   */
  documentationOfResults?: string;
}

/**
 * @group Uncertainty & Sensitivity Analysis
 * @description Interface for model uncertainty documentation specific to mechanistic source term analysis.
 * @implements MS-C6: IDENTIFY sources of model uncertainty
 * @implements MS-E3: DOCUMENT the sources of model and parameter uncertainty
 */
export interface MechanisticSourceTermModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  /** Sources of uncertainty specific to transport phenomena modeling */
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  
  /** Sources of uncertainty in source term characterization */
  sourceTermCharacterizationUncertainties?: {
    aspect: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  
  /** Reasonable alternatives for transport phenomena modeling */
  transportPhenomenaAlternatives?: {
    phenomenon: string;
    modelingApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  
  /** Reasonable alternatives for source term definition */
  sourceTermDefinitionAlternatives?: {
    aspect: string;
    selectedApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  
  /** Pre-operational assumptions specific to source terms */
  preOperationalAssumptions?: {
    assumption: string;
    relatedArea: string;
    impact: string;
    resolutionApproach: string;
  }[];
  
  /** 
   * Explicit link to HLR-MS-D uncertainty requirements
   * @implements MS-B6: IDENTIFY the sources of model uncertainty in a manner that supports HLR-MS-D
   */
  uncertaintyRequirementsLink?: {
    /** Reference to specific HLR-MS-D requirements addressed */
    hlrMsDRequirements: string[];
    
    /** Description of how the uncertainty analysis supports these requirements */
    supportDescription: string;
  };
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Documentation and traceability for the mechanistic source term analysis
 * @implements HLR-MS-E
 */
//==============================================================================

/**
 * @group Documentation & Traceability
 * @description Process documentation for the mechanistic source term analysis.
 * @implements MS-E1: DOCUMENT the process used in the Mechanistic Source Term Analysis
 */
export interface MechanisticSourceTermProcessDocumentation extends BaseProcessDocumentation {
  /** Documentation of radioactive source characterization */
  radioactiveSourceCharacterizations?: Record<string, {
    source: RadioactiveSource["uuid"];
    description: string;
    inventoryBasis: string;
  }>;
  
  /** Technical basis for the adequacy of release category definitions */
  releaseCategoryBasis?: Record<ReleaseCategoryReference, string>;
  
  /** Assignment of event sequences to release categories */
  eventSequenceToReleaseCategoryMapping?: Record<EventSequenceReference, {
    releaseCategoryReference: ReleaseCategoryReference;
    justification: string;
  }>;
  
  /** Relevant radionuclide transport phenomena for each release category */
  transportPhenomenaDocumentation?: Record<ReleaseCategoryReference, {
    phenomena: string[];
    description: string;
  }>;
  
  /** Models and computer programs used to develop source terms */
  sourceTermModelsDocumentation?: Record<string, {
    modelName: string;
    purpose: string;
    keyFeatures: string[];
  }>;
  
  /** Uncertainty and sensitivity analyses for each source term */
  uncertaintyAndSensitivityAnalysesDocumentation?: Record<SourceTermDefinitionReference, {
    analysisDescription: string;
    keyFindings: string[];
  }>;
  
  /** Surrogate risk metrics associated with intermediate states */
  surrogateRiskMetricsDocumentation?: Record<string, {
    metricDefinition: string;
    relationshipToReleaseCategories: string;
  }>;
  
  /** Quantitative source term parameter values and uncertainties */
  sourceTermParametersDocumentation?: Record<SourceTermDefinitionReference, {
    parameterValues: string;
    uncertaintyAssessment: string;
  }>;
  
  /**
   * Documentation of the integration with risk integration.
   * Describes how this analysis supports risk integration and how feedback is incorporated.
   */
  riskIntegrationDocumentation?: {
    /** Description of how this analysis supports risk integration */
    supportDescription: string;
    
    /** How release categories are used in risk integration */
    releaseCategoryUsage: string;
    
    /** How source term definitions are used in risk integration */
    sourceTermUsage: string;
    
    /** How uncertainties are propagated to risk integration */
    uncertaintyPropagation?: string;
    
    /** Challenges in integrating with risk integration */
    integrationChallenges?: string[];
    
    /** How feedback from risk integration is incorporated */
    feedbackIncorporation?: string;
    
    /** Key insights from risk integration that impact source term analysis */
    keyInsights?: string[];
  };
}

/**
 * @group Documentation & Traceability
 * @description Documentation for pre-operational assumptions in mechanistic source term analysis.
 * @implements MS-E4: DOCUMENT assumptions and limitations due to lack of as-built, as-operated details
 */
export interface MechanisticSourceTermPreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
  /** Assumptions specific to radionuclide transport barriers */
  transportBarrierAssumptions?: {
    barrier: string;
    assumption: string;
    impact: string;
    designInformationNeeded: string;
  }[];
  
  /** Assumptions specific to release timing */
  releaseTimingAssumptions?: {
    releaseCategory: ReleaseCategoryReference;
    assumption: string;
    impact: string;
    operationalInformationNeeded: string;
  }[];
  
  /** Limitations on transport phenomena modeling */
  transportPhenomenaLimitations?: {
    phenomenon: string;
    limitation: string;
    workaround: string;
    informationNeeded: string;
  }[];
}

//==============================================================================
/**
 * @group API
 * @description Represents the technical element for 4.3.16 Mechanistic Source Term Analysis (MS).
 * @remarks This technical element addresses the characterization of radiological releases to the environment.
 * @remarks It includes defining release categories, characterizing radioactive sources, modeling transport phenomena,
 * @remarks quantifying source terms, and addressing uncertainties as required by RG 1.247
 */
export interface MechanisticSourceTermAnalysis extends TechnicalElement<TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS> {
  /**
   * Additional metadata specific to Mechanistic Source Term Analysis.
   */
  additionalMetadata?: {
    /** Mechanistic source term specific limitations */
    limitations?: string[];
    
    /** Mechanistic source term specific assumptions */
    assumptions?: string[];
    
    /** Traceability information */
    traceability?: string;
    
    /** 
     * References to risk integration results that use this analysis.
     * This provides traceability between technical elements.
     */
    riskIntegrationReferences?: {
      /** ID of the risk integration analysis */
      analysisId: string;
      
      /** Version or revision of the analysis */
      version?: string;
      
      /** Date the analysis was performed */
      date?: string;
      
      /** Description of how this analysis was used in risk integration */
      usageDescription: string;
    }[];
  };

  /**
   * Definition of the set of release categories.
   * @implements MS-A1
   */
  releaseCategories: Record<ReleaseCategoryReference, ReleaseCategory>;

  /**
   * Technical basis for the adequacy of release category definitions.
   * @implements MS-E1(b)
   */
  releaseCategoryBases: Record<ReleaseCategoryReference, ReleaseCategoryBasis>;

  /**
   * Mappings of event sequences to release categories.
   * @implements MS-E1(c)
   */
  eventSequenceToReleaseCategoryMappings: EventSequenceToReleaseCategoryMapping[];

  /**
   * Characterization of the modeled sources of radioactive material and their inventories.
   * @implements MS-B1
   */
  radioactiveSources: Record<string, RadioactiveSource>;

  /**
   * Assessment of radionuclide transport barriers.
   * These barriers may reference barriers defined in the Plant Operating States module
   * while adding mechanistic source term specific characteristics.
   * @implements MS-B2
   * @implements MS-B4
   */
  radionuclideTransportBarriers: Record<string, RadionuclideTransportBarrier>;

  /**
   * Assessment of transport mechanisms for each release category.
   * @implements MS-B3
   */
  transportMechanisms: Record<string, TransportMechanism>;

  /**
   * Identification of the relevant radionuclide transport phenomena for each release category.
   * @implements MS-C1
   * @implements MS-B5: ASSESS the following phenomena for inclusion in the Mechanistic Source Term Analysis
   */
  transportPhenomenaAnalysis: Record<string, TransportPhenomena>;

  /**
   * Definition of the source term for each modeled release category, including release characteristics and timing.
   * @implements MS-E2
   */
  sourceTermDefinitions: Record<SourceTermDefinitionReference, SourceTermDefinition>;

  /**
   * Models and computer programs used in the development of source terms.
   * @implements MS-E1(e)
   */
  sourceTermModels: Record<string, SourceTermModel>;

  /**
   * Release phases defined for various source terms.
   */
  releasePhases: Record<string, ReleasePhase>;

  /**
   * Uncertainty analyses performed on the mechanistic source terms.
   * @implements MS-D1
   */
  uncertaintyAnalyses: Record<string, MechanisticSourceTermUncertaintyAnalysis>;

  /**
   * Sensitivity studies performed on source term parameters.
   * @implements MS-D2
   * @implements MS-E1(f)
   */
  sensitivityStudies: MechanisticSourceTermSensitivityStudy[];

  /**
   * Documentation of model uncertainties in the mechanistic source term analysis.
   * @implements MS-C6
   * @implements MS-E3
   */
  modelUncertaintyDocumentation: MechanisticSourceTermModelUncertaintyDocumentation;

  /**
   * Process documentation for the mechanistic source term analysis.
   * @implements MS-E1
   */
  processDocumentation: MechanisticSourceTermProcessDocumentation;

  /**
   * Documentation of pre-operational assumptions.
   * @implements MS-E4
   */
  preOperationalAssumptionsDocumentation?: MechanisticSourceTermPreOperationalAssumptionsDocumentation;
  
  /**
   * Risk integration feedback received for this analysis.
   * This field contains feedback from risk integration that should be considered
   * in future revisions of the mechanistic source term analysis.
   */
  riskIntegrationFeedback?: {
    /** ID of the risk integration analysis that provided the feedback */
    analysisId: string;
    
    /** Date the feedback was received */
    feedbackDate?: string;
    
    /** Feedback on release categories */
    releaseCategoryFeedback?: Record<ReleaseCategoryReference, {
      /** Risk significance level determined by risk integration */
      riskSignificance?: ImportanceLevel;
      
      /** Insights from risk integration */
      insights?: string[];
      
      /** Recommendations for improving the release category definition */
      recommendations?: string[];
      
      /** Status of addressing the feedback */
      status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
    }>;
    
    /** Feedback on source term definitions */
    sourceTermDefinitionFeedback?: Record<SourceTermDefinitionReference, {
      /** Risk significance level determined by risk integration */
      riskSignificance?: ImportanceLevel;
      
      /** Insights from risk integration */
      insights?: string[];
      
      /** Recommendations for improving the source term definition */
      recommendations?: string[];
      
      /** Key uncertainties identified during risk integration */
      keyUncertainties?: string[];
      
      /** Status of addressing the feedback */
      status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
    }>;
    
    /** General feedback on the mechanistic source term analysis */
    generalFeedback?: string;
    
    /** Response to the feedback */
    response?: {
      /** Description of how the feedback was or will be addressed */
      description: string;
      
      /** Changes made or planned in response to the feedback */
      changes?: string[];
      
      /** Status of the response */
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    };
  };
  
  /**
   * Documentation of the integration with risk integration.
   * Describes how this analysis is used in risk integration and how feedback is incorporated.
   */
  riskIntegrationDescription?: {
    /** Description of how this analysis supports risk integration */
    supportDescription: string;
    
    /** How release categories are used in risk integration */
    releaseCategoryUsage: string;
    
    /** How source term definitions are used in risk integration */
    sourceTermUsage: string;
    
    /** How uncertainties are propagated to risk integration */
    uncertaintyPropagation?: string;
    
    /** Challenges in integrating with risk integration */
    integrationChallenges?: string[];
    
    /** How feedback from risk integration is incorporated */
    feedbackIncorporation?: string;
  };
}

/**
 * JSON schema for validating {@link MechanisticSourceTermAnalysis} entities.
 *
 * @group API
 * @example
 * ```typescript
 * const msAnalysis: MechanisticSourceTermAnalysis = {
 *   // TechnicalElement properties
 *   uuid: "ms-001",
 *   "technical-element-type": TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS,
 *   version: "1.0",
 *   created: new Date().toISOString(),
 *   modified: new Date().toISOString(),
 *   status: "Draft",
 *   
 *   // Mechanistic Source Term specific properties
 *   releaseCategories: {
 *     "RC-LER": { 
 *       uuid: "rc-001", 
 *       name: "Large Early Release", 
 *       description: "...", 
 *       eventSequenceFamilies: ["ES-001"] 
 *     }
 *   },
 *   releaseCategoryBases: {
 *     "RC-LER": {
 *       uuid: "rcb-001",
 *       releaseCategoryReference: "RC-LER",
 *       technicalBasis: "Based on containment failure timing and release characteristics"
 *     }
 *   },
 *   eventSequenceToReleaseCategoryMappings: [
 *     {
 *       uuid: "escm-001",
 *       eventSequenceReference: "ES-001",
 *       releaseCategoryReference: "RC-LER",
 *       assignmentJustification: "Containment failure occurs early in the sequence"
 *     }
 *   ],
 *   radioactiveSources: {
 *     "rs-001": { 
 *       uuid: "rs-001", 
 *       name: "Core", 
 *       description: "...", 
 *       radionuclides: ["I-131", "Cs-137"], 
 *       totalInventory: {
 *         "I-131": { quantity: 1.0e17, unit: "Bq" },
 *         "Cs-137": { quantity: 5.0e16, unit: "Bq" }
 *       }
 *     }
 *   },
 *   radionuclideTransportBarriers: {
 *     "rtb-001": {
 *       uuid: "rtb-001",
 *       name: "Fuel Cladding",
 *       description: "Zirconium alloy cladding containing the fuel pellets",
 *       barrierType: "Physical"
 *     }
 *   },
 *   transportMechanisms: {
 *     "tm-001": {
 *       uuid: "tm-001",
 *       name: "Diffusion",
 *       description: "Transport through intact barriers via diffusion process",
 *       mechanismType: "Physical"
 *     }
 *   },
 *   transportPhenomenaAnalysis: {
 *     "tp-001": {
 *       uuid: "tp-001",
 *       releaseCategoryReference: "RC-LER",
 *       phenomena: ["Fuel cladding failure", "Containment leakage"],
 *       modelsUsed: ["MELCOR"]
 *     }
 *   },
 *   sourceTermDefinitions: {
 *     "ST-001": {
 *       uuid: "std-001",
 *       releaseCategoryReference: "RC-LER",
 *       radionuclideReleases: [
 *         {
 *           phase: { uuid: "phase-001", name: "Initial", startTime: 0, endTime: 3600 },
 *           quantities: [{ radionuclide: "I-131", quantity: 0.05, unit: "fraction" }]
 *         }
 *       ],
 *       releaseForm: { "I-131": ReleaseForm.ELEMENTAL, "Cs-137": ReleaseForm.AEROSOL },
 *       releaseTiming: [{ uuid: "phase-001", name: "Initial", startTime: 0, endTime: 3600 }]
 *     }
 *   },
 *   sourceTermModels: {
 *     "stm-001": {
 *       uuid: "stm-001",
 *       name: "MELCOR",
 *       version: "2.1",
 *       technicalBasis: "Industry standard severe accident code",
 *       validationStatus: "Validated"
 *     }
 *   },
 *   releasePhases: {
 *     "phase-001": {
 *       uuid: "phase-001",
 *       name: "Initial Release",
 *       startTime: 0,
 *       endTime: 3600,
 *       timeUnit: "seconds"
 *     }
 *   },
 *   uncertaintyAnalyses: {
 *     "ua-001": {
 *       uuid: "ua-001",
 *       name: "Source Term Uncertainty Analysis",
 *       description: "Uncertainty analysis for the LER source term",
 *       propagationMethod: "Monte Carlo Sampling",
 *       numberOfSamples: 1000,
 *       sourceTermReference: "ST-001",
 *       releaseFractionUncertainties: [
 *         {
 *           radionuclide: "I-131",
 *           description: "Uncertainty in I-131 release fraction",
 *           distributionType: DistributionType.LOGNORMAL,
 *           parameters: { median: 0.05, logstddev: 0.3 }
 *         }
 *       ]
 *     }
 *   },
 *   sensitivityStudies: [
 *     {
 *       uuid: "ss-001",
 *       name: "Containment Failure Time Sensitivity",
 *       description: "Analysis of the impact of containment failure timing on release",
 *       sourceTermReference: "ST-001",
 *       parameterChanged: "Containment failure time",
 *       variedParameters: ["Containment failure time"],
 *       parameterRanges: { "Containment failure time": [0, 24] },
 *       results: "Release timing is highly sensitive to containment failure time",
 *       insights: "Early containment failure leads to significantly higher release fractions",
 *       impactOnSourceTerm: "Release timing shifted by several hours",
 *       isKeyDriver: true
 *     }
 *   ],
 *   modelUncertaintyDocumentation: {
 *     uuid: "mud-001",
 *     name: "Source Term Model Uncertainty Documentation",
 *     description: "Documentation of uncertainties in the mechanistic source term analysis",
 *     uncertaintySources: [
 *       "Transport model simplifications",
 *       "Limited experimental data for high-temperature phenomena"
 *     ],
 *     relatedAssumptions: [
 *       "Uniform mixing within containment",
 *       "Negligible re-entrainment of deposited material"
 *     ],
 *     reasonableAlternatives: [
 *       "Alternative transport models",
 *       "Different chemical speciation assumptions"
 *     ],
 *     transportPhenomenaUncertainties: [
 *       {
 *         phenomenon: "Iodine chemistry",
 *         uncertaintySource: "Limited knowledge of high-temperature chemical kinetics",
 *         impact: "Could affect chemical form and transport behavior",
 *         treatmentApproach: "Conservative bounding assumptions"
 *       }
 *     ],
 *     uncertaintyRequirementsLink: {
 *       hlrMsDRequirements: ["HLR-MS-D.1", "HLR-MS-D.2"],
 *       supportDescription: "The uncertainty analysis supports these requirements by considering the impact of model simplifications and limited experimental data on the reliability of the source term analysis"
 *     }
 *   },
 *   processDocumentation: {
 *     uuid: "pd-001",
 *     name: "Source Term Analysis Process Documentation",
 *     description: "Documentation of the mechanistic source term analysis process",
 *     processDescription: "Systematic process for characterizing radionuclide releases",
 *     inputsDescription: "Event sequence end states, plant design information, radionuclide inventories",
 *     methodsDescription: "Modeling of transport barriers and phenomena using MELCOR code",
 *     resultsDescription: "Source terms for each release category with associated uncertainties",
 *     radioactiveSourceCharacterizations: {
 *       "rs-001": {
 *         source: "rs-001",
 *         description: "Core inventory at end of cycle",
 *         inventoryBasis: "ORIGEN calculation for 18-month fuel cycle"
 *       }
 *     },
 *     releaseCategoryBasis: {
 *       "RC-LER": "Based on containment failure timing and release magnitude"
 *     },
 *     riskIntegrationDocumentation: {
 *       supportDescription: "Risk integration is valuable for improving source term definition",
 *       releaseCategoryUsage: "Release categories are used in risk integration",
 *       sourceTermUsage: "Source term definitions are used in risk integration",
 *       uncertaintyPropagation: "Uncertainties are propagated to risk integration",
 *       integrationChallenges: ["Challenges in integrating with risk integration"],
 *       feedbackIncorporation: "Feedback is incorporated into source term definition",
 *       keyInsights: ["Containment failure timing is critical for release magnitude"]
 *     }
 *   },
 *   preOperationalAssumptionsDocumentation: {
 *     uuid: "poad-001",
 *     name: "Pre-operational Assumptions Documentation",
 *     description: "Documentation of assumptions made due to pre-operational status",
 *     assumptions: [
 *       {
 *         uuid: "pa-001",
 *         description: "Containment leakage rate assumed to be at technical specification limits",
 *         impact: "May overestimate releases for sequences with intact containment",
 *         rationale: "Conservative assumption pending as-built leakage testing"
 *       }
 *     ],
 *     validationPhase: "Construction",
 *     transportBarrierAssumptions: [
 *       {
 *         barrier: "Containment",
 *         assumption: "Leakage pathways based on design specifications",
 *         impact: "May not reflect as-built conditions",
 *         designInformationNeeded: "Post-construction leakage test results"
 *       }
 *     ]
 *   },
 *   riskIntegrationFeedback: {
 *     analysisId: "ri-001",
 *     feedbackDate: "2024-05-15",
 *     releaseCategoryFeedback: {
 *       "RC-LER": {
 *         riskSignificance: ImportanceLevel.HIGH,
 *         insights: ["Containment failure timing is critical for release magnitude"],
 *         recommendations: ["Consider containment failure timing in source term definition"],
 *         status: "ADDRESSED"
 *       }
 *     },
 *     sourceTermDefinitionFeedback: {
 *       "ST-001": {
 *         riskSignificance: ImportanceLevel.HIGH,
 *         insights: ["Containment failure timing is critical for release magnitude"],
 *         recommendations: ["Consider containment failure timing in source term definition"],
 *         keyUncertainties: ["Containment failure timing"],
 *         status: "ADDRESSED"
 *       }
 *     },
 *     generalFeedback: "Risk integration feedback is valuable for improving source term definition",
 *     response: {
 *       description: "Feedback incorporated into source term definition",
 *       changes: ["Containment failure timing considered in source term definition"]
 *     }
 *   },
 *   riskIntegrationDescription: {
 *     supportDescription: "Risk integration is valuable for improving source term definition",
 *     releaseCategoryUsage: "Release categories are used in risk integration",
 *     sourceTermUsage: "Source term definitions are used in risk integration",
 *     uncertaintyPropagation: "Uncertainties are propagated to risk integration",
 *     integrationChallenges: ["Challenges in integrating with risk integration"],
 *     feedbackIncorporation: "Feedback is incorporated into source term definition"
 *   }
 * };
 *
 * const schema = MechanisticSourceTermAnalysisSchema;
 * const validationResult = schema.validateSync(msAnalysis);
 * if (validationResult.errors) {
 *   console.error("Validation errors:", validationResult.errors);
 * } else {
 *   console.log("Mechanistic Source Term Analysis data is valid.");
 * }
 * ```
 */
export const MechanisticSourceTermAnalysisSchema = typia.json.application<
  [MechanisticSourceTermAnalysis],
  "3.0"
>();