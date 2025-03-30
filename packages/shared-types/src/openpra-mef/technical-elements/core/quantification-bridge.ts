/**
 * @module quantification_bridge
 * @description Bridge between systems-analysis and data-analysis modules for quantification
 * 
 * This module provides interfaces and utilities for managing references between
 * system basic events and their corresponding data analysis quantification.
 * 
 * @preferred
 * @category Core
 * @group Quantification
 */

/**
 * Interface for a quantification reference that bridges between 
 * data-analysis and systems-analysis modules
 */
export interface QuantificationReference {
    /**
     * Unique identifier for this quantification reference
     */
    id: string;
    
    /**
     * Reference to the basic event in systems-analysis
     */
    systemBasicEventId?: string;
    
    /**
     * Reference to component or component basic event in data-analysis
     */
    dataAnalysisReference?: string;
    
    /**
     * Type of reference to support different reference strategies
     */
    referenceType: "direct" | "template-based" | "component-based" | "custom";
    
    /**
     * Quantification method to use
     * This allows flexibility in choosing different quantification approaches
     */
    quantificationMethod?: "point-estimate" | "distribution" | "bayesian" | "maximum-likelihood" | string;
    
    /**
     * Optional metadata for extensibility
     */
    metadata?: Record<string, any>;
}

/**
 * Interface for a registry of quantification references
 * @group Quantification
 */
export interface QuantificationReferenceRegistry {
    /**
     * Map of reference IDs to quantification references
     */
    references: Record<string, QuantificationReference>;
    
    /**
     * Map of system basic event IDs to reference IDs for quick lookup
     */
    systemToReference: Record<string, string>;
    
    /**
     * Map of data analysis IDs to reference IDs for quick lookup
     */
    dataToReference: Record<string, string>;
}

/**
 * Enum for the direction of quantification workflow
 * @group Quantification
 */
export enum QuantificationDirection {
  /**
   * Starting from system analysis, referencing data analysis
   */
  SYSTEM_TO_DATA = "SYSTEM_TO_DATA",
  
  /**
   * Starting from data analysis, linking to system analysis
   */
  DATA_TO_SYSTEM = "DATA_TO_SYSTEM",
  
  /**
   * Bidirectional workflow
   */
  BIDIRECTIONAL = "BIDIRECTIONAL"
}

/**
 * Interface for configuring the quantification workflow
 */
export interface QuantificationWorkflowConfig {
  /**
   * Primary direction for this workflow
   */
  primaryDirection: QuantificationDirection;
  
  /**
   * Whether to validate references during quantification
   */
  validateReferences?: boolean;
  
  /**
   * How to handle missing references
   */
  missingReferenceHandling?: "error" | "warn" | "ignore";
  
  /**
   * Whether to cache quantification results
   */
  enableCaching?: boolean;
  
  /**
   * Optional hooks for integrating with other systems
   */
  hooks?: {
    beforeQuantification?: Function;
    afterQuantification?: Function;
  };
}

/**
 * Utility class for managing quantification references
 * This provides methods but doesn't enforce a specific implementation
 * @group Quantification
 */
export class QuantificationReferenceManager {
    /**
     * Create a reference from systems-analysis to data-analysis
     * 
     * @param systemBasicEventId - ID of the basic event in systems-analysis
     * @param dataAnalysisReference - Optional reference to data-analysis entity
     * @param options - Optional configuration for the reference
     * @returns A new QuantificationReference
     * 
     * @example
     * ```typescript
     * const ref = QuantificationReferenceManager.createReference(
     *   "BE_PUMP_FAIL",
     *   "DA_PUMP_FAIL_RATE",
     *   { referenceType: "component-based" }
     * );
     * ```
     */
    static createReference(
      systemBasicEventId: string, 
      dataAnalysisReference?: string,
      options?: {
        referenceType?: "direct" | "template-based" | "component-based" | "custom";
        quantificationMethod?: string;
        metadata?: Record<string, any>;
      }
    ): QuantificationReference {
      return {
        id: `quant_ref_${systemBasicEventId}`,
        systemBasicEventId,
        dataAnalysisReference,
        referenceType: options?.referenceType || "direct",
        quantificationMethod: options?.quantificationMethod,
        metadata: options?.metadata
      };
    }
    
    /**
     * Resolve a quantification reference to get the appropriate data
     * This method can be implemented by consumers based on their needs
     * 
     * @param reference - The reference to resolve
     * @returns The resolved data (implementation specific)
     */
    static resolveReference(reference: QuantificationReference): any {
      // This would be implemented by consumers based on their specific needs
      // It could fetch data from a service, database, or in-memory store
      return null;
    }

    /**
     * Create a new registry instance
     * 
     * @returns An empty QuantificationReferenceRegistry
     */
    static createRegistry(): QuantificationReferenceRegistry {
      return {
        references: {},
        systemToReference: {},
        dataToReference: {}
      };
    }

    /**
     * Add a reference to a registry
     * 
     * @param registry - The registry to add to
     * @param reference - The reference to add
     * @returns The updated registry
     */
    static addToRegistry(
      registry: QuantificationReferenceRegistry,
      reference: QuantificationReference
    ): QuantificationReferenceRegistry {
      registry.references[reference.id] = reference;
      
      if (reference.systemBasicEventId) {
        registry.systemToReference[reference.systemBasicEventId] = reference.id;
      }
      
      if (reference.dataAnalysisReference) {
        registry.dataToReference[reference.dataAnalysisReference] = reference.id;
      }
      
      return registry;
    }
}

/**
 * Example integration showing how to use the quantification bridge
 * 
 * @example
 * ```typescript
 * // Example workflow configuration
 * const workflowConfig: QuantificationWorkflowConfig = {
 *   primaryDirection: QuantificationDirection.BIDIRECTIONAL,
 *   validateReferences: true,
 *   missingReferenceHandling: "warn",
 *   enableCaching: true
 * };
 * 
 * // Create a reference from system to data
 * const systemToDataRef = QuantificationReferenceManager.createReference(
 *   "basic_event_wheel_flat_001",
 *   "component_tire_fl_001",
 *   {
 *     referenceType: "component-based",
 *     quantificationMethod: "weibull-distribution",
 *     metadata: {
 *       description: "Front-left wheel flat failure probability"
 *     }
 *   }
 * );
 * 
 * // Example of a data-to-system reference
 * const dataToSystemRef = QuantificationReferenceManager.createReference(
 *   "basic_event_wheel_flat_001",
 *   "component_tire_fl_001",
 *   {
 *     referenceType: "template-based",
 *     quantificationMethod: "bayesian-estimation",
 *     metadata: {
 *       estimator: "maximum-likelihood",
 *       priorDistribution: "lognormal",
 *       priorParameters: { mean: 1e-5, standardDeviation: 1e-6 }
 *     }
 *   }
 * );
 * 
 * // Create and populate a registry
 * const registry = QuantificationReferenceManager.createRegistry();
 * QuantificationReferenceManager.addToRegistry(registry, systemToDataRef);
 * QuantificationReferenceManager.addToRegistry(registry, dataToSystemRef);
 * ```
 */ 