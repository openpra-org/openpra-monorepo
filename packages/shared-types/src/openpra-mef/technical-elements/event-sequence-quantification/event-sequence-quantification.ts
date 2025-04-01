/**
 * @module event_sequence_quantification
 * 
 * The objectives of Event Sequence Quantification ensure that HLR-ESQ-A to HLR-ESQ-F are met.
 * 
 * Per RG 1.247, the objective of the event sequence quantification analysis PRA element is to develop a frequency 
 * estimate of event sequences and event sequence families at any stage of the plant life cycle, while ensuring that 
 * all risk-significant contributors are represented and understood. This element should address all dependencies and 
 * demonstrate a complete understanding of PRA uncertainties and assumptions and their impacts on the PRA results.
 * 
 * @dependency_management
 * This module intentionally minimizes direct dependencies on other technical elements:
 * 1. Uses string references and IDs instead of direct type imports
 * 2. Maintains loose coupling through well-defined interfaces
 * 3. Localizes type definitions where possible
 * 4. Documents dependencies in comments rather than through imports
 * 
 * The only exception is BarrierStatus which is imported from plant-operating-states-analysis
 * as it is the source of truth for barrier states across the PRA model.
 * 
 * This approach allows for:
 * - Independent evolution of technical elements
 * - Easier testing and maintenance
 * - Clear dependency boundaries
 * - Reduced circular dependencies
 */

// Import BarrierStatus from plant operating states for reuse in this module
import { BarrierStatus } from "../plant-operating-states-analysis/plant-operating-states-analysis";

// Re-export BarrierStatus for use by downstream modules
export { BarrierStatus };

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
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";

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
 * @remarks **ESQ-B3**
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
 * @remarks **ESQ-B1**
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
 * @remarks **ESQ-B5**
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
 * @remarks **ESQ-A1**
 * @remarks **Note ESQ-N-1**
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
 * @remarks **ESQ-B7**
 * @remarks **ESQ-B8**
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
 * @remarks **ESQ-B5**
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
 * @remarks **ESQ-B9**
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
 * @remarks **ESQ-D1**
 * @remarks **ESQ-D4**
 * @remarks **ESQ-D6**
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
 * Interface for minimal cut sets in event sequence quantification
 * @group Quantification & Uncertainty Analysis
 * @implements ESQ-B1
 * @implements ESQ-D6
 * 
 * @remarks
 * This interface stores the complete cut set information used in sequence quantification,
 * maintaining the relationship with system cut sets while including sequence-specific modifications.
 */
export interface QuantificationCutSet {
  /**
   * Reference to the original system cut set
   */
  systemCutSetReference: string;
  
  /**
   * Basic events in this cut set
   */
  events: string[];
  
  /**
   * Order of the cut set (number of events)
   */
  order: number;
  
  /**
   * Individual probabilities of each event in the cut set
   */
  eventProbabilities: Record<string, number>;
  
  /**
   * System-level probability before sequence modifications
   */
  systemProbability: number;
  
  /**
   * Sequence-specific modifications applied
   */
  sequenceModifications: {
    /**
     * Factor applied to the cut set probability
     */
    probabilityFactor: number;
    
    /**
     * Justification for the modification
     */
    modificationJustification: string;
    
    /**
     * Sequence-specific conditions affecting this cut set
     */
    sequenceConditions?: string[];
  };
  
  /**
   * Final probability in this sequence
   */
  sequenceProbability: number;
  
  /**
   * Importance measure for this cut set in this sequence
   */
  importance?: number;
  
  /**
   * Whether this cut set was included or truncated
   */
  truncationStatus: "included" | "truncated";
  
  /**
   * Justification for truncation if applicable
   */
  truncationJustification?: string;
}

/**
 * Frequency and uncertainty estimates for an event sequence
 * @remarks **ESQ-A1**
 * @remarks **ESQ-B1**
 * @remarks **ESQ-E1**
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
  
  /**
   * Cut sets contributing to this sequence's frequency
   */
  contributingCutSets?: CutSetUsage[];
  
  /**
   * Total number of cut sets considered
   */
  totalCutSets?: number;
  
  /**
   * Number of cut sets that were truncated
   */
  truncatedCutSets?: number;
  
  /**
   * Complete minimal cut sets used in this sequence's quantification
   * @example
   * ```typescript
   * minimalCutSets: [
   *   {
   *     systemCutSetReference: "SYS-RHR/CUT-001",
   *     events: ["BE-PUMP-A-FAIL", "BE-PUMP-B-FAIL"],
   *     order: 2,
   *     eventProbabilities: { "BE-PUMP-A-FAIL": 0.001, "BE-PUMP-B-FAIL": 0.001 },
   *     systemProbability: 0.000001,
   *     sequenceModifications: { probabilityFactor: 1.0, modificationJustification: "No modifications" },
   *     sequenceProbability: 0.000001,
   *     truncationStatus: "included"
   *   }
   * ]
   */
  minimalCutSets?: QuantificationCutSet[];
  
  /**
   * Summary of cut set information
   * @example
   * ```typescript
   * cutSetSummary: {
   *   totalCutSets: 50,
   *   truncatedCutSets: 2,
   *   cutSetsByOrder: { 1: 10, 2: 30, 3: 10 },
   *   dominantCutSets: [
   *     { cutSetReference: "SYS-RHR/CUT-001", contribution: 0.000001, percentage: 25 }
   *   ]
   * }
   */
  cutSetSummary?: {
    /**
     * Total number of cut sets considered
     */
    totalCutSets: number;
    
    /**
     * Number of cut sets that were truncated
     */
    truncatedCutSets: number;
    
    /**
     * Number of cut sets by order
     */
    cutSetsByOrder: Record<number, number>;
    
    /**
     * Dominant cut sets (top contributors)
     */
    dominantCutSets: {
      /**
       * Cut set reference
       */
      cutSetReference: string;
      
      /**
       * Contribution to sequence frequency
       */
      contribution: number;
      
      /**
       * Percentage of total frequency
       */
      percentage: number;
    }[];
  };
  
  /**
   * Truncation criteria used
   */
  truncationCriteria?: {
    /**
     * Method used for truncation
     */
    method: TruncationMethod;
    
    /**
     * Value used for truncation
     */
    value: number;
    
    /**
     * Justification for the truncation criteria
     */
    justification: string;
    
    /**
     * Impact of truncation on results
     */
    impact?: string;
  };
}

/**
 * Convergence analysis for event sequence quantification
 * @remarks **ESQ-B3**
 * @remarks **ESQ-B4**
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
 * @remarks **ESQ-D5**
 * @remarks **ESQ-D6**
 * @remarks **ESQ-D7**
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
 * @remarks **HLR-ESQ-E**
 * @remarks **ESQ-E1**
 * @remarks **ESQ-E2**
 * @remarks **ESQ-A5**
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
   * @remarks **ESQ-A5**
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
 * @remarks **ESQ-C8**
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
 * @remarks **ESQ-A7**
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
 * @remarks **ESQ-A2**
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
 * @remarks **HR-G6**
 * @remarks **HR-G7**
 * @remarks **HR-G8**
 * @remarks **HR-G12**
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
 * @remarks **HLR-ESQ-C**
 * @remarks **ESQ-C1**
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
   * @remarks **ESQ-C1**
   * @remarks **ESQ-C2**
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
   * @remarks **ESQ-C8**
   * @todo Future enhancement: Consider adding more detailed environmental condition modeling and time-dependent survivability analysis
   */
  equipmentSurvivabilityAssessment?: EquipmentSurvivabilityAssessment;
}

/**
 * Treatment of system successes in event sequence quantification
 * @remarks **ESQ-B6**
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
 * @remarks **ESQ-C5**
 * @group Transport Barriers & Phenomena
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
   * @implements ESQ-A3
   * @implements ESQ-C14
   */
  barrierFailureProbabilities: Record<string, Record<string, number>>;
  
  /**
   * Evaluation of barrier capabilities under different conditions
   * @implements ESQ-A3
   * @implements ESQ-C14
   */
  barrierCapabilityEvaluation: Record<string, {
    /** Conditions under which the barrier is evaluated */
    conditions: string;
    /** Capability assessment under these conditions */
    capability: string;
  }>;
  
  /** Method used to calculate barrier failure probabilities */
  calculationMethod: string;
  
  /**
   * Current states of barriers in different event sequences
   * This provides a mapping between event sequences and barrier states
   * for use by downstream modules like mechanistic source term analysis
   */
  barrierStates?: Record<string, {
    /** Event sequence ID */
    eventSequenceId: string;
    /** States of barriers in this sequence */
    states: Record<string, BarrierStatus>;
    /** Timing of barrier state changes (if applicable) */
    timing?: Record<string, {
      /** Time of state change in seconds or hours */
      time: number;
      /** Unit of time (seconds, hours, etc.) */
      unit: string;
      /** New state */
      newState: BarrierStatus;
    }[]>;
  }[]>;
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
 * @remarks **HLR-ESQ-F**
 * @remarks **ESQ-F1**
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
  
  /** 
   * Event sequence family frequencies with structured data
   * Provides a detailed representation of family frequencies with traceability
   */
  familyFrequencies: Array<{
    /** ID of the event sequence family */
    familyId: EventSequenceFamilyReference;
    
    /** Mean frequency value */
    meanFrequency: number;
    
    /** Frequency units */
    units: FrequencyUnit;
    
    /** Uncertainty distribution type, if available */
    distributionType?: DistributionType;
    
    /** Key contributors to this family's frequency */
    keyContributors?: string[];
    
    /** Reference to the detailed quantification result */
    quantificationResultReference?: string;
  }>;
  
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
 * @remarks **ESQ-F3**
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
 * @remarks **ESQ-F4**
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
 * @remarks **ESQ-F5**
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
 * @remarks Part of **HLR-ESQ-F**
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
   * @remarks **ESQ-A1**
   * @remarks **Note ESQ-N-1**:
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
   * @remarks **ESQ-B1**
   * @remarks **ESQ-D6**
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
   * @remarks **ESQ-B1**
   * @remarks **ESQ-B3**
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
     * @implements ESQ-A7
     * @todo Future enhancement: Consider adding more detailed fields for timing, success criteria, and dependencies
     */
    recoveryActionTreatment?: RecoveryActionTreatment;
    
    /** Handling of post-initiator human failure events */
    postInitiatorHFEHandling?: string;
  };

  /**
   * Integration of models from various technical elements.
   * @remarks Describes how different PRA elements are integrated into the quantification.
   * @remarks **ESQ-A2**
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
   * @remarks **HLR-ESQ-C**
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
   * @remarks **ESQ-B5**
   * @remarks **ESQ-B7**
   * @remarks **ESQ-B8**
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
   * @remarks **HLR-ESQ-E**
   * @remarks **ESQ-E1**
   * @remarks **ESQ-E2**
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
   * @remarks **ESQ-D6**
   * @remarks **ESQ-D7**
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
   * @remarks **ESQ-D1**
   * @remarks **ESQ-D4**
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
   * @remarks **ESQ-C5**
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
   * @remarks **HLR-ESQ-F**
   * @remarks **ESQ-F1**
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
   * @remarks **ESQ-F3**
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
   * @remarks **ESQ-F4**
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
   * @remarks **ESQ-F5**
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
   * @remarks Part of **HLR-ESQ-F**
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

  /**
   * Risk integration information.
   * This field provides information specifically structured for consumption by risk integration.
   * @remarks This helps maintain a clean dependency structure where Risk Integration depends on 
   * Event Sequence Quantification rather than directly on multiple upstream elements.
   */
  riskIntegrationInfo?: {
    /** 
     * Risk-significant event sequences identified in this analysis.
     * This provides a simplified view of risk-significant sequences for risk integration.
     */
    riskSignificantSequences: {
      /** ID of the event sequence or event sequence family */
      sequenceId: string;
      
      /** Type of sequence (individual or family) */
      sequenceType: "INDIVIDUAL" | "FAMILY";
      
      /** Mean frequency estimate */
      meanFrequency: number;
      
      /** Unit of frequency */
      frequencyUnit: string;
      
      /** Risk significance level */
      riskSignificance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
      
      /** Importance metrics */
      importanceMetrics?: {
        /** Fussell-Vesely importance measure */
        fussellVesely?: number;
        
        /** Risk Achievement Worth */
        raw?: number;
        
        /** Risk Reduction Worth */
        rrw?: number;
        
        /** Birnbaum importance measure */
        birnbaum?: number;
      };
      
      /** Basis for risk significance determination */
      riskSignificanceBasis?: string;
      
      /** Risk insights derived from this sequence */
      riskInsights?: string[];
      
      /** 
       * Reference to the release category for this sequence, if available.
       * Provides a link to mechanistic source term analysis.
       */
      releaseCategoryId?: string;
    }[];
    
    /**
     * Feedback received from risk integration.
     * This field contains feedback from risk integration that should be considered
     * in future revisions of the event sequence quantification.
     */
    riskIntegrationFeedback?: {
      /** ID of the risk integration analysis that provided the feedback */
      analysisId: string;
      
      /** Date the feedback was received */
      feedbackDate?: string;
      
      /** Feedback on specific event sequences */
      sequenceFeedback?: {
        /** ID of the event sequence */
        sequenceId: string;
        
        /** Risk significance level determined by risk integration */
        riskSignificance?: ImportanceLevel;
        
        /** Insights from risk integration */
        insights?: string[];
        
        /** Recommendations for improving the sequence analysis */
        recommendations?: string[];
      }[];
      
      /** General feedback on the event sequence quantification */
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
  };
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
 * @remarks **HLR-ESQ-A**
 * @remarks **HLR-ESQ-B**
 * @remarks **HLR-ESQ-C**
 * @remarks **HLR-ESQ-D**
 * @remarks **HLR-ESQ-E**
 * @remarks **HLR-ESQ-F**
 * 
 * @example
 * See the example-event-sequence-quantification.ts file for a complete example.
 * 
 * @group API
 */

/**
 * Interface for using system cut sets in event sequence quantification
 * @group Quantification & Uncertainty Analysis
 * @implements ESQ-A2
 * @implements ESQ-B1
 * 
 * @remarks
 * This interface defines how system cut sets are used in event sequence quantification.
 * It maintains the separation of concerns by:
 * 1. Using system cut sets as inputs only
 * 2. Adding sequence-specific modifications
 * 3. Tracking the relationship between system and sequence cut sets
 * 4. Maintaining validation and traceability
 */
export interface CutSetUsage {
  /**
   * Reference to the original system cut set
   */
  systemCutSetReference: string;
  
  /**
   * Sequence-specific modifications to the cut set probability
   */
  sequenceModifications: {
    /**
     * Factor applied to the cut set probability for this sequence
     */
    probabilityFactor: number;
    
    /**
     * Justification for the modification
     */
    modificationJustification: string;
    
    /**
     * Any sequence-specific conditions that affect this cut set
     */
    sequenceConditions?: string[];
  };
  
  /**
   * Final probability of this cut set in this sequence
   */
  sequenceProbability: number;
  
  /**
   * Whether this cut set contributes to the sequence frequency
   */
  contributionStatus: "active" | "truncated" | "modified";
  
  /**
   * Validation of cut set usage in this sequence
   */
  validation: {
    /**
     * Whether the usage has been validated
     */
    isValidated: boolean;
    
    /**
     * Date of last validation
     */
    validationDate?: string;
    
    /**
     * Any validation issues found
     */
    validationIssues?: string[];
  };
  
  /**
   * Traceability information
   */
  traceability: {
    /**
     * Reference to the system analysis document
     */
    systemAnalysisReference: string;
    
    /**
     * Reference to the sequence analysis document
     */
    sequenceAnalysisReference: string;
    
    /**
     * Any assumptions made in using this cut set
     */
    assumptions?: string[];
  };
}