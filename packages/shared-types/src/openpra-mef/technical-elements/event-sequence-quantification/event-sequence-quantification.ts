/**
 * @module event_sequence_quantification
 * @description Types and interfaces for Event Sequence Quantification based on RA-S-1.4-2021 Section 4.3.15
 * 
 * The objectives of Event Sequence Quantification ensure that:
 * - (a) The individual parts of the PRA model of event sequences are integrated to obtain a quantification of event sequence frequencies;
 * - (b) Quantification is performed using appropriate models and codes;
 * - (c) Functional, physical, and human dependencies are addressed;
 * - (d) Quantification supports the determination of risk-significant contributors;
 * - (e) Uncertainties in the Event Sequence Quantification are characterized;
 * - (f) The Event Sequence Quantification is documented to provide traceability of the work.
 * 
 * Per RG 1.247, the objective of the event sequence quantification analysis PRA element is to develop a frequency 
 * estimate of event sequences and event sequence families at any stage of the plant life cycle, while ensuring that 
 * all risk-significant contributors are represented and understood. This element should address all dependencies and 
 * demonstrate a complete understanding of PRA uncertainties and assumptions and their impacts on the PRA results.
 * 
 * @expert_value
 * This schema provides:
 * - Full compliance with RA-S-1.4-2021 Section 4.3.15 requirements
 * - Integration with upstream technical elements including Initiating Event Analysis, Systems Analysis, and Human Reliability Analysis
 * - Comprehensive dependency tracking across functional, physical, and human aspects
 * - Mechanisms for breaking circular logic and identifying mutually exclusive events
 * - Robust uncertainty characterization and propagation
 * - Structured sensitivity and importance analyses
 * - Clear traceability of data sources and modeling assumptions
 * 
 * @dependency_structure
 * This module depends on multiple upstream technical elements:
 * 1. Initiating Event Analysis - Provides initiating event frequencies
 * 2. Event Sequence Analysis - Provides event sequence structures
 * 3. Systems Analysis - Provides system models and basic event probabilities
 * 4. Human Reliability Analysis - Provides human error probabilities
 * 5. Data Analysis - Provides parameter distributions for uncertainty analysis
 * 
 * @preferred
 * @category Technical Elements 
 */

// TODO: Future enhancements needed:
// 1. Add EventTimingRepresentation interface for time-dependent equipment survivability assessment
// 2. Implement ParameterSelectionCriteria interface to address ESQ-A8/A9 (reference HR-D, HR-G, HR-H, DA-C, DA-D)
// 3. Create ScreenedInitiatingEventAssessment interface for ESQ-D8 to track cumulative impact of screened events

// Core imports
import typia, { tags } from "typia";
import { Named, Unique } from "../core/meta";

// Event and data analysis imports
import { 
  BaseEvent, 
  InitiatingEvent, 
  FrequencyUnit 
} from "../core/events";
import { 
  Uncertainty, 
  DistributionType, 
  BayesianUpdate
} from "../data-analysis/data-analysis";

// Other technical element imports
import { 
  TechnicalElement, 
  TechnicalElementTypes, 
  TechnicalElementMetadata 
} from "../technical-element";
// This line ensures the EVENT_SEQUENCE_QUANTIFICATION type is available
// EVENT_SEQUENCE_QUANTIFICATION = "event-sequence-quantification"
import { 
  EventSequence, 
  EventSequenceFamily, 
  DependencyType 
} from "../event-sequence-analysis/event-sequence-analysis";
import { 
  SystemDefinition, 
  FaultTree, 
  CommonCauseFailureGroup 
} from "../systems-analysis/systems-analysis";
import { 
  InitiatingEventGroup, 
  ExtendedInitiatingEvent 
} from "../initiating-event-analysis/initiating-event-analysis";

// Documentation and shared patterns imports
import { 
  ImportanceLevel, 
  ScreeningStatus, 
  ScreeningCriteria,
  SensitivityStudy,
  BaseUncertaintyAnalysis
} from "../core/shared-patterns";

// Import from uncertainty.ts instead of shared-patterns.ts
import {
  BaseAssumption as Assumption
} from "../core/documentation";

// Import documentation interfaces from documentation.ts
import {
  BaseTraceabilityDocumentation,
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePreOperationalAssumptionsDocumentation,
  BasePeerReviewDocumentation
} from "../core/documentation";

// Define FrequencyQuantification interface if it's missing from events.ts
interface FrequencyQuantification {
  /** The value of the frequency */
  value: number;
  /** The unit of the frequency */
  unit: string;
}

/**
 * Runtime validation functions for EventSequenceQuantification
 * @group API
 */
export const validateEventSequenceQuantification = {
  /**
   * Validates the consistency between event sequence families and their member sequences
   * @param analysis - The EventSequenceQuantification to validate
   * @returns Array of validation error messages
   */
  validateFamilyConsistency: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    
    // Check if all event sequences referenced in families are referenced in quantification results
    Object.entries(analysis.eventSequenceFamilies).forEach(([familyId, family]) => {
      for (const sequenceId of family.memberSequenceIds) {
        const sequenceInResults = Object.values(analysis.quantificationResults).some(
          result => result.sequenceId === sequenceId && result.sequenceType === "INDIVIDUAL"
        );
        
        if (!sequenceInResults) {
          errors.push(`Family ${familyId} references sequence ${sequenceId} that is not quantified in results`);
        }
      }
      
      // Check if representative sequence is a member of the family
      if (!family.memberSequenceIds.includes(family.representativeSequenceId)) {
        errors.push(`Representative sequence ${family.representativeSequenceId} is not a member of family ${familyId}`);
      }
    });
    
    return errors;
  },
  
  /**
   * Validates the treatment of dependencies in the analysis
   * @param analysis - The EventSequenceQuantification to validate
   * @returns Array of validation error messages
   */
  validateDependencyTreatment: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    
    // Check if all dependency types are addressed
    const requiredDependencyTypes = ["FUNCTIONAL", "PHYSICAL", "HUMAN"];
    
    for (const depType of requiredDependencyTypes) {
      if (!analysis.dependencyTreatment.dependenciesByType[depType as DependencyType]) {
        errors.push(`Required dependency type ${depType} is not addressed in the analysis`);
      }
    }
    
    return errors;
  },
  
  /**
   * Validates the convergence of the truncation analysis
   * @param analysis - The EventSequenceQuantification to validate
   * @returns Array of validation error messages
   */
  validateConvergence: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    
    const { truncation } = analysis.quantificationMethods;
    
    // Check if truncation progression has at least 3 values to demonstrate convergence
    if (truncation.truncationProgression.length < 3) {
      errors.push(`Truncation progression needs at least 3 values to demonstrate convergence`);
    }
    
    // Check if truncation values are in decreasing order
    for (let i = 1; i < truncation.truncationProgression.length; i++) {
      if (truncation.truncationProgression[i] >= truncation.truncationProgression[i-1]) {
        errors.push(`Truncation values must be in decreasing order`);
        break;
      }
    }
    
    return errors;
  },
  
  /**
   * Validates the uncertainty analysis
   * @param analysis - The EventSequenceQuantification to validate
   * @returns Array of validation error messages
   */
  validateUncertaintyAnalysis: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    
    // Check if simulation-based methods have enough samples
    if (
      (analysis.uncertaintyAnalysis.propagationMethod === "MONTE_CARLO" ||
       analysis.uncertaintyAnalysis.propagationMethod === "LATIN_HYPERCUBE") &&
      (!analysis.uncertaintyAnalysis.numberOfSamples || analysis.uncertaintyAnalysis.numberOfSamples < 1000)
    ) {
      errors.push(`Simulation-based uncertainty propagation requires at least 1000 samples`);
    }
    
    // Check if unquantified uncertainties have sensitivity studies
    const unquantifiedUncertainties = analysis.uncertaintyAnalysis.modelUncertainties.filter(
      u => !u.isQuantified
    );
    
    if (
      unquantifiedUncertainties.length > 0 && 
      (!analysis.uncertaintyAnalysis.sensitivityStudies ||
       analysis.uncertaintyAnalysis.sensitivityStudies.length === 0)) {
      errors.push(`Unquantified uncertainties must be addressed via sensitivity studies`);
    }
    
    // Check state-of-knowledge correlation
    const { stateOfKnowledgeCorrelation } = analysis.uncertaintyAnalysis;
    if (!stateOfKnowledgeCorrelation.isConsidered && !stateOfKnowledgeCorrelation.justificationIfNotConsidered) {
      errors.push(`If state-of-knowledge correlation is not considered, justification must be provided`);
    }
    
    return errors;
  },
  
  /**
   * Validates the documentation completeness
   * @param analysis - The EventSequenceQuantification to validate
   * @returns Array of validation error messages
   */
  validateDocumentation: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    
    // Check for required documentation fields
    const requiredDocFields = [
      "processDescription", "inputs", "appliedMethods", "resultsSummary", 
      "quantificationProcess", "truncationProcess", "familyFrequencies"
    ];
    
    for (const field of requiredDocFields) {
      if (!analysis.documentation[field]) {
        errors.push(`Required documentation field '${field}' is missing`);
      }
    }
    
    return errors;
  }
};

/**
 * JSON schema for validating {@link EventSequenceQuantification} entities.
 * Includes both type-level and runtime validations.
 *
 * @example
 * ```typescript
 * // Type-level validation (compile time)
 * const analysis: EventSequenceQuantification = { ... };
 *
 * // Runtime validation
 * const schema = EventSequenceQuantificationSchema;
 * const validationResult = schema.validateSync(analysis);
 * if (!validationResult.success) {
 *   console.error(validationResult.errors);
 * }
 *
 * // Additional runtime checks
 * const familyErrors = validateEventSequenceQuantification.validateFamilyConsistency(analysis);
 * const dependencyErrors = validateEventSequenceQuantification.validateDependencyTreatment(analysis);
 * const convergenceErrors = validateEventSequenceQuantification.validateConvergence(analysis);
 * 
 * if (familyErrors.length > 0 || dependencyErrors.length > 0 || convergenceErrors.length > 0) {
 *   console.error("Validation errors found:", {
 *     familyErrors,
 *     dependencyErrors,
 *     convergenceErrors
 *   });
 * }
 * ```
 * @group API
 */
export const EventSequenceQuantificationSchema = typia.json.application<[EventSequenceQuantification], "3.0">();

// List of interfaces that are dependent on the ESQ technical element file:
/**
 * - {@link MechanisticSourceTermAnalysis} (in `mechanistic_source_term_analysis.ts`): References ESQ for sequence frequencies
 * - {@link RiskIntegrationAnalysis} (in `risk_integration_analysis.ts`): Integrates ESQ results into overall risk metrics
 */

// List of other technical elements that need to import this typescript file for ESQ:
/**
 * - `mechanistic_source_term_analysis.ts`: To reference the event sequence frequencies
 * - `risk_integration_analysis.ts`: To use ESQ results in risk integration
 * - `release_category_analysis.ts`: To map sequences to release categories
 */

/**
 * @group Core Definitions & Enums
 * @description Basic types, enums, and utility interfaces used throughout the module
 */
//==============================================================================

/**
 * Reference to an Event Sequence by its unique identifier
 * @description Used to reference event sequences without creating circular dependencies
 * @example
 * ```typescript
 * const esReference: EventSequenceReference = "ES-LOCA-001";
 * ```
 * @group Core Definitions & Enums
 */
export type EventSequenceReference = string;

/**
 * Reference to an Event Sequence Family by its unique identifier
 * @description Used to reference event sequence families without creating circular dependencies
 * @example
 * ```typescript
 * const esfReference: EventSequenceFamilyReference = "ESF-LOCA-SMALL";
 * ```
 * @group Core Definitions & Enums
 */
export type EventSequenceFamilyReference = string;

/**
 * Enum representing the different methods for truncating event sequences
 * @remarks **ESQ-B3**: USE a truncation value that is sufficiently low to ensure convergence of the overall event sequence or PRA model frequency.
 * @group Core Definitions & Enums
 */
export enum TruncationMethod {
  /** Truncate based on absolute frequency value */
  ABSOLUTE_FREQUENCY = "ABSOLUTE_FREQUENCY",
  
  /** Truncate based on percentage of total frequency */
  PERCENTAGE_OF_TOTAL = "PERCENTAGE_OF_TOTAL",
  
  /** Truncate based on number of significant digits */
  SIGNIFICANT_DIGITS = "SIGNIFICANT_DIGITS",
  
  /** Truncate based on relative contribution to specific end states */
  RELATIVE_CONTRIBUTION = "RELATIVE_CONTRIBUTION"
}

/**
 * Enum representing the different approaches for quantifying event sequence frequencies
 * @remarks **ESQ-B1**: QUANTIFY the frequency of each specified modeled event sequence and event sequence family using a method that integrates...
 * @group Core Definitions & Enums
 */
export enum QuantificationApproach {
  /** Fault Tree Linking approach */
  FAULT_TREE_LINKING = "FAULT_TREE_LINKING",
  
  /** Event Tree with Boundary Conditions approach */
  EVENT_TREE_BOUNDARY_CONDITIONS = "EVENT_TREE_BOUNDARY_CONDITIONS",
  
  /** Binary Decision Diagram approach */
  BINARY_DECISION_DIAGRAM = "BINARY_DECISION_DIAGRAM",
  
  /** Markov Model approach */
  MARKOV_MODEL = "MARKOV_MODEL",
  
  /** Discrete Event Simulation approach */
  DISCRETE_EVENT_SIMULATION = "DISCRETE_EVENT_SIMULATION",
  
  /** Monte Carlo Simulation approach */
  MONTE_CARLO_SIMULATION = "MONTE_CARLO_SIMULATION"
}

/**
 * Enum representing the circular logic resolution methods
 * @remarks **ESQ-B5**: IDENTIFY and RESOLVE circular logic in the event sequence models.
 * @group Core Definitions & Enums
 */
export enum CircularLogicResolutionMethod {
  /** Break loops by inserting conditional split fractions */
  CONDITIONAL_SPLIT_FRACTIONS = "CONDITIONAL_SPLIT_FRACTIONS",
  
  /** Use of transfer gates and flag variables to break circular references */
  TRANSFER_GATES = "TRANSFER_GATES",
  
  /** Iterative convergence methods */
  ITERATIVE_CONVERGENCE = "ITERATIVE_CONVERGENCE",
  
  /** Logic transformations to remove circles */
  LOGIC_TRANSFORMATION = "LOGIC_TRANSFORMATION"
}

/**
 * Reference to a Source by its unique identifier
 * @description Used to reference radioactive material sources without creating circular dependencies
 * @example
 * ```typescript
 * const sourceReference: SourceReference = "SRC-CORE-001";
 * ```
 * @group Core Definitions & Enums
 */
export type SourceReference = string;

/**
 * Reference to a Source Term by its unique identifier
 * @description Used to reference mechanistic source terms without creating circular dependencies
 * @example
 * ```typescript
 * const sourceTermReference: SourceTermReference = "MST-LOCA-001";
 * ```
 * @group Core Definitions & Enums
 */
export type SourceTermReference = string;

/**
 * Detailed representation of an event sequence family for quantification purposes
 * @remarks **ESQ-A1**: DELINEATE the event sequences or event sequence families to be modeled in the Event Sequence Quantification by specifying the associated... 
 * @remarks **Note ESQ-N-1**: ...event sequence family, which should group event sequences with similar source, plant operating state, initiating event, plant response, and mechanistic source term.
 * @example
 * ```typescript
 * const esfQuantification: EventSequenceFamilyQuantification = {
 *   familyId: "ESF-LOCA-SMALL",
 *   description: "Small LOCA with subsequent loss of offsite power",
 *   memberSequenceIds: ["ES-LOCA-001", "ES-LOCA-002"],
 *   representativeSequenceId: "ES-LOCA-001",
 *   groupingCriteriaId: "GC-LOCA-SMALL",
 *   representativeSourceId: "SRC-CORE-001",
 *   representativePlantOperatingStateId: "POS-FULL-POWER",
 *   representativeInitiatingEventId: "IE-LOCA-SMALL",
 *   representativePlantResponse: "Loss of offsite power with successful ECCS injection"
 * };
 * ```
 * @group Core Definitions & Enums
 */
export interface EventSequenceFamilyQuantification extends Unique, Named {
  /** Family identifier */
  familyId: string;
  
  /** Optional detailed description of the family */
  description?: string;
  
  /** IDs of the event sequences that are members of this family */
  memberSequenceIds: EventSequenceReference[];
  
  /** ID of the representative event sequence for this family */
  representativeSequenceId: EventSequenceReference;
  
  /** ID of the criteria used for grouping event sequences into this family */
  groupingCriteriaId: string;
  
  /** ID of the representative source of radioactive material for the family */
  representativeSourceId: SourceReference;
  
  /** ID of the representative plant operating state for the family */
  representativePlantOperatingStateId: string;
  
  /** ID of the representative initiating event for this family */
  representativeInitiatingEventId: string;
  
  /** Description of the representative plant response for this family */
  representativePlantResponse: string;
  
  /** ID of the representative source term for this family (optional as not all sequences have releases) */
  representativeSourceTermId?: SourceTermReference;
  
  /** Flag indicating whether dependencies were considered in grouping */
  dependenciesConsideredInGrouping?: boolean;
  
  /** Basis for selecting the representative sequence */
  representativeSequenceSelectionBasis?: string;
}

/**
 * Detailed representation of mutually exclusive events and combinations
 * @remarks **ESQ-B7**: IDENTIFY mutually exclusive event combinations.
 * @remarks **ESQ-B8**: ELIMINATE mutually exclusive event combinations from the event sequence model or provide a justification for retaining them.
 * @group Core Definitions & Enums
 */
export interface MutuallyExclusiveEvents {
  /** Unique identifier for this set of mutually exclusive events */
  id: string;
  
  /** Description of the mutually exclusive relationship */
  description: string;
  
  /** IDs of the events that are mutually exclusive */
  eventIds: string[];
  
  /** Logical basis for the mutual exclusivity */
  basis: string;
  
  /** Method used to eliminate or handle the mutual exclusivity */
  treatmentMethod: string;
  
  /** Justification if mutually exclusive events are retained */
  retentionJustification?: string;
}

/**
 * Representation of a circular logic situation in the event sequence model
 * @remarks **ESQ-B5**: IDENTIFY and RESOLVE circular logic in the event sequence models.
 * @group Core Definitions & Enums
 */
export interface CircularLogic {
  /** Unique identifier for this circular logic */
  id: string;
  
  /** Description of the circular logic */
  description: string;
  
  /** IDs of the events or systems involved in the circular logic */
  involvedElementIds: string[];
  
  /** How the circular logic was detected */
  detectionMethod: string;
  
  /** Method used to resolve the circular logic */
  resolutionMethod: CircularLogicResolutionMethod;
  
  /** Description of how the circular logic was resolved */
  resolutionDescription: string;
  
  /** Impact of the resolution on the results */
  resolutionImpact?: string;
}

/**
 * Representation of a flag event in the event sequence quantification
 * @remarks **ESQ-B9**: When flag events are used in the quantification of event sequence frequencies, DEVELOP a traceable process for the use of flag events.
 * @group Core Definitions & Enums
 */
export interface FlagEvent extends Unique, Named {
  /** Purpose of the flag event */
  purpose: string;
  
  /** Logic state of the flag event (true, false) */
  state: boolean;
  
  /** Effect of the flag event on the model */
  effect: string;
  
  /** Basis for using the flag event */
  basis: string;
  
  /** Whether the flag event is temporary or permanent */
  isTemporary: boolean;
}

//==============================================================================
/**
 * @group Quantification & Uncertainty Analysis
 * @description Interfaces for quantifying sequences, characterizing uncertainty, and analyzing importance
 * @implements HLR-ESQ-A, HLR-ESQ-B, HLR-ESQ-D, HLR-ESQ-E
 */
//==============================================================================

/**
 * Review process for event sequence quantification
 * @remarks **ESQ-D1**: REVIEW the event sequence results to ensure they make logical sense.
 * @remarks **ESQ-D4**: COMPARE results to similar plants, where available, accounting for design differences.
 * @remarks **ESQ-D6**: IDENTIFY the contributions to the frequencies of key risk-significant event sequences and event sequence families from relevant initiating events, system failures, and human errors.
 * @group Quantification & Uncertainty Analysis
 */
export interface QuantificationReviewProcess {
  /** Review criteria used to evaluate results */
  reviewCriteria: string[];
  
  /** Findings from the review process */
  reviewFindings: {
    /** Finding identifier */
    id: string;
    
    /** Description of the finding */
    description: string;
    
    /** Actions taken to address the finding */
    correctiveActions?: string;
  }[];
  
  /** Comparison to similar plants (if available) */
  plantComparison?: {
    /** Plants used for comparison */
    comparisonPlants: string[];
    
    /** Key differences identified */
    keyDifferences: string[];
    
    /** Explanation of differences */
    differenceExplanation: string;
  };
  
  /** Review of event sequence family grouping */
  familyGroupingReview?: {
    /** Criteria used for grouping review */
    groupingCriteria: string[];
    
    /** Issues identified in grouping */
    groupingIssues: string[];
  };
}

/**
 * Frequency and uncertainty estimates for an event sequence
 * @remarks **ESQ-A1**: DELINEATE the event sequences or event sequence families to be modeled in the Event Sequence Quantification...
 * @remarks **ESQ-B1**: QUANTIFY the frequency of each specified modeled event sequence and event sequence family using a method that integrates...
 * @remarks **ESQ-E1**: CHARACTERIZE the uncertainty in the event sequence frequencies and PROVIDE the basis for the characterization.
 * @group Quantification & Uncertainty Analysis
 */
export interface EventSequenceFrequencyEstimate {
  /** ID of the event sequence or family */
  sequenceId: string;
  
  /** Type of sequence (individual or family) */
  sequenceType: "INDIVIDUAL" | "FAMILY";
  
  /** Mean frequency estimate */
  meanFrequency: FrequencyQuantification;
  
  /** Uncertainty distribution */
  uncertaintyDistribution: {
    /** Type of distribution */
    type: DistributionType;
    
    /** Parameters of the distribution (specific to distribution type) */
    parameters: Record<string, number>;
  };
  
  /** Confidence intervals */
  confidenceIntervals?: {
    /** 5th percentile */
    percentile05?: number;
    
    /** 50th percentile (median) */
    percentile50?: number;
    
    /** 95th percentile */
    percentile95?: number;
  };
  
  /** Sources of uncertainty that significantly impact this sequence */
  significantUncertaintySources?: string[];
  
  /** Sensitivity analysis results specific to this sequence */
  sensitivityResults?: {
    /** Parameter or assumption varied */
    parameter: string;
    
    /** Range of variation */
    range: [number, number];
    
    /** Effect on frequency */
    frequencyEffect: [number, number];
  }[];
}

/**
 * Convergence analysis for event sequence quantification
 * @remarks **ESQ-B3**: USE a truncation value that is sufficiently low to ensure convergence of the overall event sequence or PRA model frequency.
 * @remarks **ESQ-B4**: DEMONSTRATE that the truncation value(s) used in the final event sequence quantification demonstrates convergence toward a stable result.
 * @group Quantification & Uncertainty Analysis
 */
export interface ConvergenceAnalysis {
  /** Method used for truncation */
  truncationMethod: TruncationMethod;
  
  /** Final truncation value used */
  finalTruncationValue: number;
  
  /** Progression of truncation values tested */
  truncationProgression: number[];
  
  /** Total frequency at each truncation level */
  frequencyAtTruncation: Record<number, number>;
  
  /** Percentage change between truncation levels */
  percentageChangeAtTruncation: Record<number, number>;
  
  /** Basis for selecting the final truncation value */
  basisForSelection: string;
  
  /** Demonstration of convergence */
  convergenceDemonstration: string;
  
  /** Sensitivity of results to truncation value */
  truncationSensitivity?: string;
}

/**
 * Importance analysis for event sequence quantification
 * @remarks **ESQ-D5**: DETERMINE the frequencies of event sequence families.
 * @remarks **ESQ-D6**: IDENTIFY the contributions to the frequencies of key risk-significant event sequences and event sequence families from relevant initiating events...
 * @remarks **ESQ-D7**: IDENTIFY the significant basic events (equipment unavailabilities and human failure events), event sequence families, and fault tree top events that contributes to risk-significant event sequences...
 * @group Quantification & Uncertainty Analysis
 */
export interface ImportanceAnalysis {
  /** Type of importance analysis */
  analysisType: "FUSSELL_VESELY" | "RISK_REDUCTION_WORTH" | "RISK_ACHIEVEMENT_WORTH" | "BIRNBAUM" | "OTHER";
  
  /** Scope of the analysis */
  scope: "OVERALL" | "PER_SEQUENCE" | "PER_FAMILY";
  
  /** Importance results for basic events */
  basicEventImportance?: Record<string, number>;
  
  /** Importance results for initiating events */
  initiatingEventImportance?: Record<string, number>;
  
  /** Importance results for human failure events */
  humanFailureEventImportance?: Record<string, number>;
  
  /** Importance results for fault tree top events */
  topEventImportance?: Record<string, number>;
  
  /** Cutoff value used for significance determination */
  significanceCutoff?: number;
  
  /** Risk-significant basic events */
  significantBasicEvents?: string[];
  
  /** Risk-significant initiating events */
  significantInitiatingEvents?: string[];
  
  /** Risk-significant human failure events */
  significantHumanFailureEvents?: string[];
  
  /** Risk-significant fault tree top events */
  significantTopEvents?: string[];
}

/**
 * Comprehensive uncertainty analysis for event sequence quantification
 * @remarks **HLR-ESQ-E**: Uncertainties in the Event Sequence Quantification results shall be characterized and quantified to the extent practical. Key sources of model uncertainty and assumptions shall be identified, and their potential impact on the results shall be understood. Those sources of uncertainty that are not quantified shall be addressed via sensitivity analysis.
 * @remarks **ESQ-E1**: CHARACTERIZE the uncertainty in the event sequence frequencies and PROVIDE the basis for the characterization.
 * @remarks **ESQ-E2**: IDENTIFY the key sources of model uncertainty for each event sequence family.
 * @remarks **ESQ-A5**: QUANTIFY the mean frequency of each modeled event sequence family by propagating the uncertainty distributions of the risk-significant input parameters in such a way that the state-of-knowledge correlation is taken into account unless it can be demonstrated that the effect of the state-of-knowledge correlation is not risk-significant.
 * @group Quantification & Uncertainty Analysis
 */
export interface EventQuantUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  /** Parameter uncertainties considered */
  parameterUncertainties: {
    /** Parameter name or ID */
    parameterId: string;
    
    /** Distribution type */
    distributionType: DistributionType;
    
    /** Distribution parameters */
    distributionParameters: Record<string, number>;
    
    /** Basis for the distribution */
    basis: string;
  }[];
  
  /** Correlation between uncertainties, if modeled */
  correlations?: {
    /** IDs of the correlated parameters */
    parameterIds: string[];
    
    /** Correlation coefficient */
    correlationCoefficient: number;
    
    /** Basis for the correlation */
    basis: string;
  }[];
  
  /**
   * State-of-knowledge correlation handling
   * @remarks **ESQ-A5**: QUANTIFY the mean frequency of each modeled event sequence family by propagating the uncertainty distributions of the risk-significant input parameters in such a way that the state-of-knowledge correlation is taken into account unless it can be demonstrated that the effect of the state-of-knowledge correlation is not risk-significant.
   */
  stateOfKnowledgeCorrelation: {
    /** Whether state-of-knowledge correlation is considered */
    isConsidered: boolean;
    
    /** Justification if state-of-knowledge correlation is not considered */
    justificationIfNotConsidered?: string;
    
    /** Method used to account for state-of-knowledge correlation */
    handlingMethod?: "SAME_RANDOM_SEED" | "EXPLICIT_CORRELATION_MATRIX" | "PARAMETER_GROUPING" | "OTHER";
    
    /** Description of how state-of-knowledge correlation is handled */
    handlingDescription?: string;
    
    /** Parameters for which state-of-knowledge correlation is considered */
    correlatedParameters?: string[][];
    
    /** Assessment of the impact of state-of-knowledge correlation on results */
    impactAssessment?: string;
  };
}

//==============================================================================
/**
 * @group Integration & Dependencies
 * @description Interfaces for integrating models and handling dependencies
 * @implements HLR-ESQ-C
 */
//==============================================================================

/**
 * Assessment of equipment survivability under adverse environmental conditions
 * @remarks **ESQ-C8**: ASSESS the survivability of equipment under adverse environmental conditions in the quantification of event sequences.
 * @group Integration & Dependencies
 */
export interface EquipmentSurvivabilityAssessment {
  /** Equipment identifiers for which survivability is assessed */
  equipmentIds: string[];
  
  /** Environmental conditions considered in the assessment */
  environmentalConditions: {
    /** Type of environmental condition (e.g., temperature, pressure, radiation) */
    type: string;
    
    /** Severity or range of the condition */
    severity: string;
  }[];
  
  /** Criteria used to determine survivability */
  survivabilityCriteria: string;
  
  /** Results of the survivability assessment */
  assessmentResults: {
    /** Equipment identifier */
    equipmentId: string;
    
    /** Whether the equipment is expected to survive */
    survives: boolean;
    
    /** Basis for the survivability determination */
    basis: string;
  }[];
}

/**
 * Treatment of recovery actions in event sequence quantification
 * @remarks **ESQ-A7**: INCLUDE recovery actions in the event sequence quantification that have a reasonable probability of success taking into account the applicable adverse environments and the time available.
 * @group Integration & Dependencies
 */
export interface RecoveryActionTreatment {
  /** List of recovery actions with their IDs and descriptions */
  recoveryActions: {
    /** Unique identifier for the recovery action */
    id: string;
    
    /** Description of the recovery action */
    description: string;
  }[];
  
  /** Method used to incorporate recovery actions into the quantification */
  modelingMethod: string;
}

/**
 * Integration of components for event sequence quantification
 * @remarks **ESQ-A2**: INTEGRATE the event sequences, system models, event progression phenomena, barrier failure modes, data, and human reliability analysis elements, accounting for all functional, physical, and human dependencies and recovery actions, into a frequency estimate.
 * @group Integration & Dependencies
 */
export interface ModelIntegration {
  /** Integration method */
  integrationMethod: string;
  
  /** Software tools used */
  softwareTools: string[];
  
  /** Integration steps */
  integrationSteps: string[];
  
  /** Verification of integration */
  integrationVerification: string;
  
  /** Integration issues encountered and resolutions */
  integrationIssues?: {
    /** Issue description */
    description: string;
    
    /** Issue resolution */
    resolution: string;
  }[];
}

/**
 * Representation of human failure event dependencies in cutsets
 * @remarks **HR-G6**: EVALUATE the degree of dependence between the HFEs in the same sequence or scenario.
 * @remarks **HR-G7**: ACCOUNT for the influence of success or failure in preceding human actions and system performance on the defined human event through the evaluation of dependency.
 * @remarks **HR-G8**: EVALUATE the potential for dependency between HFEs and include such dependencies in the PRA model.
 * @remarks **HR-G12**: INCLUDE the combined effect of multiple human errors in the same accident sequence or cut set.
 * @group Integration & Dependencies
 */
export interface HumanFailureEventDependency {
  /** List of human failure events that are dependent */
  dependentHFEs: string[];
  
  /** Level of dependency ("ZERO", "LOW", "MEDIUM", "HIGH", "COMPLETE") */
  dependencyLevel: string;
  
  /** Adjusted probabilities after dependency assessment */
  adjustedProbabilities: Record<string, number>;
}

/**
 * Representation of dependencies in event sequence quantification
 * @remarks **HLR-ESQ-C**: The Event Sequence Quantification shall be done in a manner that all identified functional, physical, and human dependencies are addressed.
 * @remarks **ESQ-C1**: INCORPORATE functional, physical, and human dependencies into the event sequence model or PROVIDE a basis for dismissal.
 * @group Integration & Dependencies
 */
export interface DependencyRepresentation {
  /** Dependencies by type */
  dependenciesByType: Record<DependencyType, {
    /** Description of how this dependency type is addressed */
    treatmentDescription: string;
    
    /** Method used to model this dependency type */
    modelingMethod: string;
    
    /** Specific examples of this dependency type in the model */
    examples: string[];
  }>;
  
  /** Treatment of post-initiator human error dependencies */
  postInitiatorHFEDependencies: {
    /** Method for addressing dependencies */
    dependencyMethod: string;
    
    /** Basis for the method */
    methodBasis: string;
    
    /** Examples of dependent HFEs */
    dependentHFEExamples: string[];
  };
  
  /** 
   * Detailed human failure event dependencies in cutsets
   * @remarks **ESQ-C1**: INCORPORATE functional, physical, and human dependencies into the event sequence model
   * @remarks **ESQ-C2**: INCLUDE the impact of human dependencies in the event sequence quantification
   */
  humanFailureEventDependencies?: HumanFailureEventDependency[];
  
  /** Treatment of common cause failures */
  commonCauseFailures: {
    /** CCF modeling approach */
    modelingApproach: string;
    
    /** CCF parameter basis */
    parameterBasis: string;
    
    /** CCF groups modeled */
    ccfGroupsModeled: string[];
  };
  
  /** Dependencies in accident progression phenomena */
  phenomenologicalDependencies: {
    /** Phenomena considered */
    phenomenaConsidered: string[];
    
    /** Modeling approach */
    modelingApproach: string;
    
    /** Basis for the approach */
    basisForApproach: string;
  };
  
  /** Dependencies in recovery actions */
  recoveryActionDependencies: {
    /** Recovery actions modeled */
    recoveryActionsModeled: string[];
    
    /** Dependencies considered */
    dependenciesConsidered: string[];
    
    /** Modeling approach */
    modelingApproach: string;
  };
  
  /** 
   * Assessment of equipment survivability under adverse conditions
   * @remarks **ESQ-C8**: ASSESS the survivability of equipment under adverse environmental conditions in the quantification of event sequences.
   * @todo Future enhancement: Consider adding more detailed environmental condition modeling and time-dependent survivability analysis
   */
  equipmentSurvivabilityAssessment?: EquipmentSurvivabilityAssessment;
}

/**
 * Treatment of system successes in event sequence quantification
 * @remarks **ESQ-B6**: ACCOUNT for the effect of system success in event sequences.
 * @group Integration & Dependencies
 */
export interface SystemSuccessTreatment {
  /** Method for handling system successes */
  treatmentMethod: string;
  
  /** Systems for which success is explicitly modeled */
  systemsWithSuccessModeled: string[];
  
  /** Impact of success modeling on results */
  impactOnResults: string;
  
  /** Examples of how system success is modeled */
  modelingExamples: string[];
}

/**
 * Treatment of radionuclide transport barriers in event sequence quantification
 * @remarks **ESQ-C5**: INTEGRATE the radionuclide transport barrier failure modes, phenomena, equipment failures, and human failures into the Event Sequence Quantification to resolve the mechanistic source term.
 * @group Integration & Dependencies
 */
export interface RadionuclideBarrierTreatment {
  /** Barriers considered */
  barriersConsidered: string[];
  
  /** Failure modes for each barrier */
  barrierFailureModes: Record<string, string[]>;
  
  /** Integration method for each barrier */
  barrierIntegrationMethod: Record<string, string>;
  
  /** Phenomena affecting each barrier */
  barrierPhenomena: Record<string, string[]>;
  
  /** Treatment of barrier challenges */
  barrierChallengesTreatment: string;
  
  /** Basis for barrier capacity analysis */
  barrierCapacityBasis: string;
  
  /** 
   * Failure probabilities for each barrier and failure mode
   * @implements ESQ-A3: INTEGRATE the event sequences, system models, event progression phenomena, barrier failure modes
   * @implements ESQ-C14: INCLUDE the radionuclide transport barrier failure modes
   */
  barrierFailureProbabilities: Record<string, Record<string, number>>;
  
  /**
   * Evaluation of barrier capabilities under different conditions
   * @implements ESQ-A3: INTEGRATE the event sequences, system models, event progression phenomena, barrier failure modes
   * @implements ESQ-C14: INCLUDE the radionuclide transport barrier failure modes
   */
  barrierCapabilityEvaluation: Record<string, {
    /** Conditions under which the barrier is evaluated */
    conditions: string;
    /** Capability assessment under these conditions */
    capability: string;
    /** Failure probability under these conditions */
    failureProbability?: number;
  }[]>;
  
  /**
   * Method used to calculate barrier failure probabilities
   * @implements ESQ-A3: INTEGRATE the event sequences, system models, event progression phenomena, barrier failure modes
   * @implements ESQ-C14: INCLUDE the radionuclide transport barrier failure modes
   */
  calculationMethod: string;
}

//==============================================================================
/**
 * @group Documentation & Traceability
 * @description Interfaces for documenting the analysis process and assumptions
 * @implements HLR-ESQ-F
 */
//==============================================================================

/**
 * Documentation of the Event Sequence Quantification process
 * @remarks **HLR-ESQ-F**: The documentation of the Event Sequence Quantification shall provide traceability of the work.
 * @remarks **ESQ-F1**: DOCUMENT the process used in the Event Sequence Quantification, specifying what is used as input, the applied methods, and the results.
 * @group Documentation & Traceability
 */
export interface EventSequenceQuantificationDocumentation extends BaseProcessDocumentation {
  /** Process description */
  processDescription: string;
  
  /** Inputs used */
  inputs: string[];
  
  /** Methods applied */
  appliedMethods: string[];
  
  /** Summary of results */
  resultsSummary: string;
  
  /** Process for adding non-recovery terms */
  nonRecoveryTermsProcess?: string;
  
  /** Cutset review process */
  cutsetReviewProcess?: string;
  
  /** Quantification process */
  quantificationProcess: string;
  
  /** Truncation process and values */
  truncationProcess: string;
  
  /** Event sequence family frequencies */
  familyFrequencies: Record<string, string>;
  
  /** Risk insights */
  riskInsights: string[];
  
  /** Event sequences and binning method */
  eventSequencesAndBinning: string;
  
  /** Treatment of dependencies */
  dependenciesTreatment: string;
  
  /** Radionuclide barrier treatment */
  radionuclideBarrierTreatment: string;
  
  /** Mutually exclusive events treatment */
  mutuallyExclusiveEventsTreatment: string;
  
  /** Asymmetries in quantitative modeling */
  asymmetriesInModeling?: string;
  
  /** Computer code used */
  computerCodeUsed: string;
  
  /** Parameter estimates not documented elsewhere */
  parameterEstimatesNotDocumented?: string;
  
  /** Approach to intermediate states */
  intermediateStatesApproach?: string;
  
  /** Risk significance drivers */
  riskSignificanceDrivers?: string;
  
  /** Comparison to similar plants */
  comparisonToSimilarPlants?: string;
  
  /** Index signature to allow string indexing */
  [key: string]: any;
}

/**
 * Documentation of model uncertainties in Event Sequence Quantification
 * @remarks **ESQ-F3**: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives associated with the Event Sequence Quantification.
 * @group Documentation & Traceability
 */
export interface EventSequenceQuantificationUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  /** Sources of model uncertainty */
  modelUncertaintySources: {
    /** Source ID */
    sourceId: string;
    
    /** Description of the uncertainty source */
    description: string;
    
    /** Impact on results */
    impact: string;
    
    /** Assumptions made */
    relatedAssumptions: string[];
    
    /** Alternative approaches considered */
    alternativeApproaches: string[];
    
    /** How the uncertainty was addressed */
    treatmentApproach: string;
  }[];
  
  /** Key assumptions */
  keyAssumptions: Assumption[];
  
  /** Reasonable alternatives considered - mapped to match BaseModelUncertaintyDocumentation */
  reasonableAlternatives: {
    /** Alternative description - mapped to 'alternative' */
    alternative: string;
    
    /** Why it wasn't selected - mapped to 'reasonNotSelected' */
    reasonNotSelected: string;
    
    /** Applicable elements */
    applicableElements?: string[];
    
    /** Additional fields specific to this implementation */
    alternativeId?: string;
    potentialImpact?: string;
  }[];
}

/**
 * Documentation of limitations in the Event Sequence Quantification
 * @remarks **ESQ-F4**: DOCUMENT limitations in the quantification process that would impact applications.
 * @group Documentation & Traceability
 */
export interface EventSequenceQuantificationLimitationsDocumentation {
  /** Limitations in the quantification process */
  quantificationLimitations: {
    /** Limitation ID */
    limitationId: string;
    
    /** Description of the limitation */
    description: string;
    
    /** Impact on applications */
    applicationImpact: string;
    
    /** Potential workarounds */
    potentialWorkarounds?: string;
  }[];
  
  /** Validation scope limitations */
  validationLimitations?: string[];
  
  /** Data limitations */
  dataLimitations?: string[];
  
  /** Model integration limitations */
  modelIntegrationLimitations?: string[];
  
  /** Other limitations */
  otherLimitations?: string[];
}

/**
 * Documentation of pre-operational assumptions and limitations
 * @remarks **ESQ-F5**: For PRAs conducted in the pre-operational stage, DOCUMENT assumptions and limitations of the Event Sequence Quantification due to the lack of as-built, as-operated details.
 * @group Documentation & Traceability
 */
export interface EventSequenceQuantificationPreOperationalDocumentation extends BasePreOperationalAssumptionsDocumentation {
  /** Pre-operational assumptions */
  preOperationalAssumptions: {
    /** Assumption ID */
    assumptionId: string;
    
    /** Description of the assumption */
    description: string;
    
    /** Impact on the analysis */
    impact: string;
    
    /** How the assumption will be validated */
    validationApproach: string;
    
    /** When validation will occur */
    validationTiming: string;
  }[];
  
  /** Pre-operational limitations */
  preOperationalLimitations: {
    /** Limitation ID */
    limitationId: string;
    
    /** Description of the limitation */
    description: string;
    
    /** Impact on the analysis */
    impact: string;
    
    /** How the limitation will be addressed */
    resolutionApproach: string;
  }[];
}

/**
 * Peer review documentation for Event Sequence Quantification
 * @remarks Part of **HLR-ESQ-F**: The documentation of the Event Sequence Quantification shall provide traceability of the work.
 * @group Documentation & Traceability
 */
export interface EventSequenceQuantificationPeerReviewDocumentation extends BasePeerReviewDocumentation {
  /** Review date */
  reviewDate: string;
  
  /** Review team */
  reviewTeam: string[];
  
  /** Review scope */
  reviewScope: string;
  
  /** Review findings */
  findings: {
    /** Finding ID */
    findingId: string;
    
    /** Finding description */
    description: string;
    
    /** Finding significance */
    significance: "HIGH" | "MEDIUM" | "LOW";
    
    /** Finding status */
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    
    /** Finding resolution */
    resolution?: string;
    
    /** Associated requirement */
    associatedRequirement?: string;
  }[];
  
  /** Review conclusions */
  conclusions: string;
}

//==============================================================================
/**
 * @group API
 */
export interface EventSequenceQuantification extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION> {
  /**
   * Additional metadata specific to Event Sequence Quantification.
   * @remarks Includes details like the version of the analysis, analyst, and review status.
   * @see ASME/ANS RA-S-1.4-2021 Table 4.3.15.1-7 (ESQ-F1)
   * @example
   * ```typescript
   * metadata: {
   *   version: "1.0",
   *   analysisDate: "2024-07-26",
   *   analyst: "Jane Doe",
   *   reviewer: "John Smith",
   *   approvalStatus: "Approved",
   *   scope: ["Internal Events"],
   *   limitations: ["Conservative assumptions used for some parameters"],
   *   assumptions: [{ id: "A-001", description: "No external events considered in this quantification." }]
   * }
   * ```
   */
  metadata: {
    version: string;
    analysisDate: string;
    analyst: string;
    reviewer?: string;
    approvalStatus?: string;
    scope?: string[];
    limitations?: string[];
    assumptions?: Assumption[];
  };

  /**
   * Event sequence families defined for quantification.
   * @remarks Specifies how individual event sequences are grouped into families for quantification.
   * @remarks **ESQ-A1**: DELINEATE the event sequences or event sequence families to be modeled.
   * @remarks **Note ESQ-N-1**: An event sequence family is a group of event sequences with similar source, plant operating state, initiating event, plant response, and mechanistic source term.
   * @example
   * ```typescript
   * eventSequenceFamilies: {
   *   "LOCA-Small-LossOfOffsitePower": {
   *     description: "Small LOCA with subsequent loss of offsite power",
   *     eventSequenceIds: ["LOCA-001", "LOCA-002"],
   *     representativeInitiatingEventId: "SLOCA",
   *     representativePlantOperatingStateId: "POS-FULL-POWER"
   *   }
   * }
   * ```
   */
  eventSequenceFamilies: Record<string, EventSequenceFamilyQuantification>;

  /**
   * Quantification results for each event sequence and family.
   * @remarks Includes frequency estimates, uncertainty analyses, and risk-significant contributors.
   * @remarks **ESQ-B1**: QUANTIFY the frequency of each specified modeled event sequence and event sequence family.
   * @remarks **ESQ-D6**: IDENTIFY the contributions to the frequencies of key risk-significant event sequences.
   * @example
   * ```typescript
   * quantificationResults: {
   *   "LOCA-Small-LossOfOffsitePower": {
   *     meanFrequency: { value: 1.0e-5, unit: "/year" },
   *     uncertaintyDistribution: { type: "LOGNORMAL", parameters: { median: 1.0e-5, errorFactor: 3.0 } },
   *     riskSignificantContributors: ["Diesel Generator Failure", "Operator Failure to Recover Offsite Power"]
   *   }
   * }
   * ```
   */
  quantificationResults: Record<string, EventSequenceFrequencyEstimate>;

  /**
   * Details of the quantification methods used.
   * @remarks Specifies the computer codes, truncation levels, and overall approach.
   * @remarks **ESQ-B1**: QUANTIFY the frequency of each specified modeled event sequence and event sequence family using a method that integrates the event sequences, system models, etc.
   * @remarks **ESQ-B3**: USE a truncation value that is sufficiently low to ensure convergence of the overall event sequence or PRA model frequency.
   * @example
   * ```typescript
   * quantificationMethods: {
   *   approach: QuantificationApproach.FAULT_TREE_LINKING,
   *   computerCodes: [{ name: "RISKMAN", version: "3.2", verificationDocumentation: "VALID-001", validationDocumentation: "VALID-001" }],
   *   truncation: {
   *     method: TruncationMethod.ABSOLUTE_FREQUENCY,
   *     finalValue: 1.0e-9,
   *     convergenceDemonstration: "Sequence frequencies changed by less than 1% when truncation was lowered from 1.0e-9 to 1.0e-10"
   *   }
   * }
   * ```
   */
  quantificationMethods: {
    /** Quantification approach used */
    approach: QuantificationApproach;
    
    /** 
     * Computer codes used 
     * @implements ESQ-B1: QUANTIFY the frequency of each specified modeled event sequence and event sequence family using a method that integrates the event sequences, system models, etc.
     * @todo Future enhancement: Consider adding more detailed V&V documentation including test cases, benchmarking results, and configuration management
     */
    computerCodes: {
      /** Name of the code */
      name: string;
      
      /** Version of the code */
      version: string;
      
      /** 
       * Verification documentation - confirms the code correctly implements the intended algorithms 
       * Required to address ESQ-B1 verification requirements
       */
      verificationDocumentation: string;
      
      /** 
       * Validation documentation - confirms the code is suitable for the application 
       * Required to address ESQ-B1 validation requirements
       */
      validationDocumentation: string;
      
      /** Reference to code validation */
      validationReference?: string;
    }[];
    
    /** Truncation details */
    truncation: ConvergenceAnalysis;
    
    /** 
     * Treatment of recovery actions 
     * @implements ESQ-A7: INCLUDE recovery actions in the event sequence quantification that have a reasonable probability of success
     * @todo Future enhancement: Consider adding more detailed fields for timing, success criteria, and dependencies
     */
    recoveryActionTreatment?: RecoveryActionTreatment;
    
    /** Handling of post-initiator human failure events */
    postInitiatorHFEHandling?: string;
  };

  /**
   * Integration of models from various technical elements.
   * @remarks Describes how different PRA elements are integrated into the quantification.
   * @remarks **ESQ-A2**: INTEGRATE the event sequences, system models, event progression phenomena, barrier failure modes, data, and human reliability analysis elements.
   * @example
   * ```typescript
   * modelIntegration: {
   *   integrationMethod: "Linked Event Trees with Fault Trees",
   *   softwareTools: ["RISKMAN", "CAFTA"],
   *   integrationSteps: ["Link initiating events to event trees", "Map system failures to fault trees", "..."],
   *   integrationVerification: "Verified through manual checks of selected sequences"
   * }
   * ```
   */
  modelIntegration: ModelIntegration;

  /**
   * Treatment of dependencies in quantification.
   * @remarks Describes how functional, physical, and human dependencies are addressed.
   * @remarks **HLR-ESQ-C**: The Event Sequence Quantification shall be done in a manner that all identified functional, physical, and human dependencies are addressed.
   * @example
   * ```typescript
   * dependencyTreatment: {
   *   dependenciesByType: {
   *     "FUNCTIONAL": {
   *       treatmentDescription: "Modeled through explicit system fault tree linking",
   *       modelingMethod: "Shared basic events and logical connections",
   *       examples: ["Support system X failure impacts frontline systems Y and Z"]
   *     },
   *     // ... other dependency types
   *   },
   *   // ... other dependency aspects
   * }
   * ```
   */
  dependencyTreatment: DependencyRepresentation;

  /**
   * Handling of circular logic and mutually exclusive events.
   * @remarks Describes how logical challenges in the model are addressed.
   * @remarks **ESQ-B5**: IDENTIFY and RESOLVE circular logic in the event sequence models.
   * @remarks **ESQ-B7**: IDENTIFY mutually exclusive event combinations.
   * @remarks **ESQ-B8**: ELIMINATE mutually exclusive event combinations from the event sequence model or provide a justification for retaining them.
   * @example
   * ```typescript
   * logicalChallenges: {
   *   circularLogic: {
   *     "CIRC-001": {
   *       description: "Circular dependency between system A and system B",
   *       involvedElementIds: ["SYS-A", "SYS-B"],
   *       resolutionMethod: CircularLogicResolutionMethod.CONDITIONAL_SPLIT_FRACTIONS,
   *       resolutionDescription: "Used conditional split fractions to break the loop"
   *     }
   *   },
   *   mutuallyExclusiveEvents: {
   *     "MEX-001": {
   *       description: "Pump A and Pump B cannot both fail due to same cause",
   *       eventIds: ["BE-PUMP-A-CCF", "BE-PUMP-B-CCF"],
   *       basis: "Different design and location",
   *       treatmentMethod: "Explicit logic in fault trees"
   *     }
   *   }
   * }
   * ```
   */
  logicalChallenges: {
    /** Circular logic situations and their resolutions */
    circularLogic: Record<string, CircularLogic>;
    
    /** Mutually exclusive events and their treatment */
    mutuallyExclusiveEvents: Record<string, MutuallyExclusiveEvents>;
    
    /** Flag events used in quantification */
    flagEvents?: Record<string, FlagEvent>;
    
    /** Treatment of system successes */
    systemSuccessTreatment: SystemSuccessTreatment;
  };

  /**
   * Uncertainty and sensitivity analyses.
   * @remarks Characterizes uncertainties and their impact on results.
   * @remarks **HLR-ESQ-E**: Uncertainties in the Event Sequence Quantification results shall be characterized and quantified to the extent practical.
   * @remarks **ESQ-E1**: CHARACTERIZE the uncertainty in the event sequence frequencies and PROVIDE the basis for the characterization.
   * @remarks **ESQ-E2**: IDENTIFY the key sources of model uncertainty for each event sequence family.
   * @example
   * ```typescript
   * uncertaintyAnalysis: {
   *   propagationMethod: "MONTE_CARLO",
   *   numberOfSamples: 10000,
   *   randomSeed: 12345,
   *   parameterUncertainties: [
   *     {
   *       parameterId: "PARAM-001",
   *       distributionType: DistributionType.LOGNORMAL,
   *       distributionParameters: { mean: 1.0e-3, errorFactor: 3 },
   *       basis: "Industry data with Bayesian update"
   *     }
   *   ],
   *   // ... other uncertainty aspects
   * }
   * ```
   */
  uncertaintyAnalysis: EventQuantUncertaintyAnalysis;

  /**
   * Importance analysis of contributors.
   * @remarks Identifies significant contributors to risk.
   * @remarks **ESQ-D6**: IDENTIFY the contributions to the frequencies of key risk-significant event sequences and event sequence families.
   * @remarks **ESQ-D7**: IDENTIFY the significant basic events, event sequence families, and fault tree top events that contribute to risk-significant event sequences.
   * @example
   * ```typescript
   * importanceAnalysis: {
   *   "FUSSELL_VESELY": {
   *     analysisType: "FUSSELL_VESELY",
   *     scope: "OVERALL",
   *     basicEventImportance: {
   *       "BE-001": 0.23,
   *       "BE-002": 0.18
   *     },
   *     significanceCutoff: 0.05,
   *     significantBasicEvents: ["BE-001", "BE-002"]
   *   }
   * }
   * ```
   */
  importanceAnalysis: Record<string, ImportanceAnalysis>;

  /**
   * Review process for quantification results.
   * @remarks Documents the review of results for logical consistency and comparison to similar plants.
   * @remarks **ESQ-D1**: REVIEW the event sequence results to ensure they make logical sense.
   * @remarks **ESQ-D4**: COMPARE results to similar plants, where available, accounting for design differences.
   * @todo Future enhancement: Consider adding more detailed review documentation including peer review findings and resolution tracking
   * @example
   * ```typescript
   * quantificationReview: {
   *   reviewCriteria: ["Logical consistency", "Comparison to similar plants", "Reasonableness of results"],
   *   reviewFindings: [
   *     {
   *       id: "FIND-001",
   *       description: "Sequence XYZ frequency appears unusually high",
   *       correctiveActions: "Reviewed and corrected fault tree logic for system A"
   *     }
   *   ],
   *   plantComparison: {
   *     comparisonPlants: ["Plant X", "Plant Y"],
   *     keyDifferences: ["Different ECCS design", "Different support system dependencies"],
   *     differenceExplanation: "Higher LOCA frequencies due to different pipe material specifications"
   *   }
   * }
   * ```
   */
  quantificationReview?: QuantificationReviewProcess;

  /**
   * Treatment of radionuclide barriers.
   * @remarks Describes how barriers to prevent and mitigate event sequences are modeled.
   * @remarks **ESQ-C5**: INTEGRATE the radionuclide transport barrier failure modes, phenomena, equipment failures, and human failures into the Event Sequence Quantification to resolve the mechanistic source term.
   * @example
   * ```typescript
   * barrierTreatment: {
   *   barriersConsidered: ["Fuel Cladding", "RCS Boundary", "Containment"],
   *   barrierFailureModes: {
   *     "Fuel Cladding": ["Overtemperature", "Mechanical Damage"],
   *     // ... other barriers
   *   },
   *   // ... other barrier aspects
   * }
   * ```
   */
  barrierTreatment: RadionuclideBarrierTreatment;

  /**
   * Documentation of the Event Sequence Quantification process.
   * @remarks Provides traceability of the work, including inputs, methods, and results.
   * @remarks **HLR-ESQ-F**: The documentation of the Event Sequence Quantification shall provide traceability of the work.
   * @remarks **ESQ-F1**: DOCUMENT the process used in the Event Sequence Quantification, specifying what is used as input, the applied methods, and the results.
   * @example
   * ```typescript
   * documentation: {
   *   processDescription: "Event trees and fault trees were integrated and quantified using a Monte Carlo simulation approach.",
   *   inputs: ["Component reliability databases", "Plant-specific operating experience"],
   *   appliedMethods: ["Fault Tree Linking", "Monte Carlo Uncertainty Propagation"],
   *   resultsSummary: "Overall CDF is estimated at 2.5e-5 per year, with...",
   *   // ... other documentation aspects
   * }
   * ```
   */
  documentation: EventSequenceQuantificationDocumentation;

  /**
   * Documentation of model uncertainties.
   * @remarks Documents sources of model uncertainty, related assumptions, and alternatives.
   * @remarks **ESQ-F3**: DOCUMENT the sources of model uncertainty, related assumptions, and reasonable alternatives associated with the Event Sequence Quantification.
   * @example
   * ```typescript
   * uncertaintyDocumentation: {
   *   modelUncertaintySources: [
   *     {
   *       sourceId: "MU-001",
   *       description: "Uncertainty in success criteria for system X",
   *       impact: "Moderate impact on sequence frequencies",
   *       relatedAssumptions: ["Success assumed based on design calculations"],
   *       alternativeApproaches: ["More conservative success criteria"],
   *       treatmentApproach: "Sensitivity analysis performed"
   *     }
   *   ],
   *   // ... other uncertainty documentation aspects
   * }
   * ```
   */
  uncertaintyDocumentation: EventSequenceQuantificationUncertaintyDocumentation;

  /**
   * Documentation of quantification limitations.
   * @remarks Documents limitations that would impact applications.
   * @remarks **ESQ-F4**: DOCUMENT limitations in the quantification process that would impact applications.
   * @example
   * ```typescript
   * limitationsDocumentation: {
   *   quantificationLimitations: [
   *     {
   *       limitationId: "LIM-001",
   *       description: "Limited plant-specific data for certain components",
   *       applicationImpact: "May affect uncertainty in specific sequences",
   *       potentialWorkarounds: "Use of sensitivity studies to bound impact"
   *     }
   *   ],
   *   // ... other limitations documentation aspects
   * }
   * ```
   */
  limitationsDocumentation: EventSequenceQuantificationLimitationsDocumentation;

  /**
   * Documentation of pre-operational assumptions and limitations.
   * @remarks Documents assumptions and limitations due to lack of as-built, as-operated details.
   * @remarks **ESQ-F5**: For PRAs conducted in the pre-operational stage, DOCUMENT assumptions and limitations of the Event Sequence Quantification due to the lack of as-built, as-operated details.
   * @example
   * ```typescript
   * preOperationalDocumentation: {
   *   preOperationalAssumptions: [
   *     {
   *       assumptionId: "PA-001",
   *       description: "Component reliability based on design specifications",
   *       impact: "May not reflect as-built performance",
   *       validationApproach: "Update with plant-specific data when available",
   *       validationTiming: "After first year of operation"
   *     }
   *   ],
   *   // ... other pre-operational documentation aspects
   * }
   * ```
   */
  preOperationalDocumentation?: EventSequenceQuantificationPreOperationalDocumentation;

  /**
   * Peer review documentation.
   * @remarks Documents peer review of the Event Sequence Quantification.
   * @remarks Part of **HLR-ESQ-F**: The documentation of the Event Sequence Quantification shall provide traceability of the work.
   * @example
   * ```typescript
   * peerReviewDocumentation: {
   *   reviewDate: "2024-08-15",
   *   reviewTeam: ["John Smith", "Jane Doe"],
   *   reviewScope: "Complete ESQ technical element",
   *   findings: [
   *     {
   *       findingId: "F-001",
   *       description: "Some dependency relationships not fully documented",
   *       significance: "MEDIUM",
   *       status: "CLOSED",
   *       resolution: "Documentation updated to include all dependencies",
   *       associatedRequirement: "ESQ-C1"
   *     }
   *   ],
   *   conclusions: "ESQ element meets requirements with minor improvements recommended"
   * }
   * ```
   */
  peerReviewDocumentation?: EventSequenceQuantificationPeerReviewDocumentation;

  /**
   * References to the Mechanistic Source Term Analysis.
   * @remarks Ensures integration between event sequence quantification and source term evaluation.
   * @see RG 1.247 Section C.1.3.15
   * @example
   * ```typescript
   * mechanisticSourceTermAnalysisReferences: ["MST-REP-001", "MST-CALC-002"]
   * ```
   */
  mechanisticSourceTermAnalysisReferences?: string[];
}

/**
 * @description Main interfaces for external consumption, validation schemas, and integration points
 */
//==============================================================================

/**
 * Main interface for Event Sequence Quantification
 * Implements comprehensive quantification of event sequences including integration,
 * dependency treatment, uncertainty analysis, and documentation
 * 
 * @remarks **HLR-ESQ-A**: The individual modeling items of the PRA shall be integrated to support Event Sequence Quantification which shall quantify the frequency of each modeled event sequence and event sequence family. The integration shall include the event sequences, system models, event progression phenomena, barrier failure modes, data, and human reliability analysis elements, and shall account for functional, physical, and human dependencies and recovery actions.
 * @remarks **HLR-ESQ-B**: Quantification of the event sequences shall be performed using appropriate models and codes, a truncation level sufficiently low to show convergence, and shall address method-specific limitations and features. Quantification shall also address the breaking of circular logic, identification of mutually exclusive event combinations, use of flag events and modules, and performance of Event Sequence Quantification including the use of system successes.
 * @remarks **HLR-ESQ-C**: The Event Sequence Quantification shall be done in a manner that all identified functional, physical, and human dependencies are addressed.
 * @remarks **HLR-ESQ-D**: The Event Sequence Quantification results shall be reviewed, and the risk-significant contributors to the frequency of each risk-significant event sequence and event sequence family shall be identified.
 * @remarks **HLR-ESQ-E**: Uncertainties in the Event Sequence Quantification results shall be characterized and quantified to the extent practical. Key sources of model uncertainty and assumptions shall be identified, and their potential impact on the results shall be understood.
 * @remarks **HLR-ESQ-F**: The documentation of the Event Sequence Quantification shall provide traceability of the work.
 * 
 * @example
 * See the example-event-sequence-quantification.ts file for a complete example.
 * 
 * @group API
 */