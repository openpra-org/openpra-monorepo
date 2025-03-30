/**
 * @module event_sequence_quantification_references
 * 
 * This file provides re-exports of types from upstream technical elements
 * that are needed by downstream elements, particularly Risk Integration.
 * 
 * By centralizing these re-exports, we maintain a cleaner dependency structure
 * where Risk Integration depends primarily on Event Sequence Quantification
 * rather than directly on multiple upstream elements.
 */

// Re-export types from event-sequence-analysis
export { 
    EventSequenceReference,
    EventSequenceFamilyReference,
    ReleaseCategoryMapping
} from "../event-sequence-analysis/event-sequence-analysis";

// Re-export types from initiating-event-analysis
export { 
    PlantOperatingStateReference 
} from "../initiating-event-analysis/initiating-event-analysis";

// Re-export types from systems-analysis
export { 
    SystemReference 
} from "../systems-analysis/systems-analysis";

// Re-export types from core shared patterns
export { 
    SuccessCriteriaId 
} from "../core/shared-patterns";

/**
 * Risk-integrated event sequence results with importance metrics and risk significance.
 * This interface consolidates event sequence quantification results with risk significance
 * information to simplify access by Risk Integration.
 */
export interface RiskSignificantEventSequence {
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
} 