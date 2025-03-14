/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Documentation types and interfaces for technical elements
 */

import typia, { tags } from "typia";
import { Unique, Named } from "./meta";
import { ImportanceLevel } from "./shared-patterns";


/**
 * @namespace technical_elements.core.documentation
 * @description Base documentation types and interfaces for the technical elements
 */


/**
 * Base interface for design information sources and their traceability
 * 
 * This interface provides a structured way to reference design documents that inform 
 * technical element development, particularly important for:
 * - Success criteria bases
 * - Deterministic analyses
 * - Technical basis for barrier treatment
 * - Pre-operational PRA assumptions and their resolution
 * @group Documentation & Traceability
 */
export interface BaseDesignInformation {
    /** 
     * Identifier for the design source document 
     */
    sourceId: string;

    /** 
     * Type of source document (e.g., "drawing", "calculation", "specification") 
     */
    sourceType: string;

    /** 
     * Document revision identifier 
     */
    revision?: string;

    /** 
     * Date of the source document 
     * @format date
     */
    date?: string;

    /** 
     * Description of the design information 
     */
    description?: string;

    /** 
     * Requirement identifier for traceability 
     */
    requirementId?: string;

    /** 
     * Section number in relevant standard (e.g., "4.3.3" in RA-S-1.4-2021) 
     */
    standardSection?: string;
}

/**
 * Base interface for process documentation across technical elements.
 * Provides a consistent structure for documenting analysis processes.
 * 
 * @group Documentation & Traceability
 */
export interface BaseProcessDocumentation extends Unique, Named {
    /** Description of the overall process used */
    processDescription: string;
    
    /** Description of inputs used in the analysis */
    inputsDescription?: string;
    
    /** Design information sources used in the analysis */
    designInformation?: BaseDesignInformation[];
    
    /** Description of methods applied in the analysis */
    methodsDescription?: string;
    
    /** Description of the results of the analysis */
    resultsDescription?: string;
    
    /** References to supporting documentation */
    supportingDocumentationReferences?: string[];
    
    /** Traceability to requirements */
    requirementReferences?: {
        /** Requirement identifier */
        requirementId: string;
        /** How the requirement is addressed */
        implementation: string;
    }[];
}

/**
 * Base interface for model uncertainty documentation across technical elements.
 * Provides a consistent structure for documenting uncertainties and assumptions.
 * 
 * @group Documentation & Traceability
 */
export interface BaseModelUncertaintyDocumentation extends Unique, Named {
    /** Sources of model uncertainty */
    uncertaintySources: {
        /** Source description */
        source: string;
        /** Impact on analysis */
        impact: string;
        /** Applicable elements */
        applicableElements?: string[];
    }[];
    
    /** Related assumptions */
    relatedAssumptions: {
        /** Assumption description */
        assumption: string;
        /** Basis for assumption */
        basis: string;
        /** Applicable elements */
        applicableElements?: string[];
    }[];
    
    /** Reasonable alternatives considered */
    reasonableAlternatives: {
        /** Alternative description */
        alternative: string;
        /** Reason not selected */
        reasonNotSelected: string;
        /** Applicable elements */
        applicableElements?: string[];
    }[];
    
    /** Reference to requirement */
    requirementReference?: string;
}

/**
 * Base interface for pre-operational assumptions documentation across technical elements.
 * Provides a consistent structure for documenting assumptions made before operation.
 * 
 * @group Documentation & Traceability
 */
export interface BasePreOperationalAssumptionsDocumentation extends Unique, Named {
    /** Assumptions due to lack of as-built, as-operated details */
    assumptions: {
        /** Assumption ID */
        assumptionId: string;
        
        /** Description of the assumption */
        description: string;
        
        /** Rationale for the assumption */
        rationale: string;
        
        /** Limitations imposed by this assumption */
        limitations: string[];
        
        /** Impact on the analysis */
        impact: string;
        
        /** Design information needed to resolve the assumption */
        requiredDesignInformation?: BaseDesignInformation[];
        
        /** Plan to address when as-built information becomes available */
        resolutionPlan?: string;
        
        /** Current status */
        status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    }[];
    
    /** References to supporting documentation */
    supportingDocumentationReferences?: string[];
    
    /** Plant construction or operational phase when assumption can be validated */
    validationPhase?: string;
}

/**
 * Base interface for peer review documentation across technical elements.
 * Provides a consistent structure for documenting peer reviews.
 * 
 * @group Documentation & Traceability
 */
export interface BasePeerReviewDocumentation extends Unique, Named {
    /** Review date */
    reviewDate: string;
    
    /** Review team members */
    reviewers: string[];
    
    /** Findings and observations */
    findingsAndObservations: {
        /** Finding ID */
        id: string;
        
        /** Description of the finding */
        description: string;
        
        /** Significance of the finding */
        significance: ImportanceLevel;
        
        /** Resolution status */
        resolutionStatus: "OPEN" | "CLOSED" | "IN_PROGRESS";
        
        /** Resolution actions */
        resolutionActions?: string[];
        
        /** Associated requirements */
        associatedRequirements?: string[];
    }[];
    
    /** Scope of the review */
    scope: string;
    
    /** Review methodology */
    methodology: string;
    
    /** Review report reference */
    reportReference?: string;
}

/**
 * @internal
 * JSON schema for validating documentation entities.
 * @group Documentation & Traceability
 */
export const DocumentationSchemas = {
    designInformation: typia.json.application<[BaseDesignInformation], "3.0">(),
    processDocumentation: typia.json.application<[BaseProcessDocumentation], "3.0">(),
    modelUncertainty: typia.json.application<[BaseModelUncertaintyDocumentation], "3.0">(),
    preOperationalAssumptions: typia.json.application<[BasePreOperationalAssumptionsDocumentation], "3.0">(),
    peerReview: typia.json.application<[BasePeerReviewDocumentation], "3.0">()
} as const;
