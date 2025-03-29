/**
 * @packageDocumentation
 * @module technical_elements
 * @description OpenPRA Technical Elements Schema - Types and interfaces for PRA technical elements
 * 
 * > [View Documentation Guide](./index.html)
 */

/**
 * @namespace technical_elements.core
 * @description Core types, patterns, and metadata for technical elements
 */
export * as core from './core';

/**
 * @namespace technical_elements.plant_operating_states_analysis
 * @description Plant Operating States Analysis types and interfaces
 */
export * as plant_operating_states_analysis from './plant-operating-states-analysis/plant-operating-states-analysis';

/**
 * @namespace technical_elements.data_analysis
 * @description Data Analysis types and interfaces
 */
export * as data_analysis from './data-analysis';

/**
 * @namespace technical_elements.initiating_event_analysis
 * @description Initiating Event Analysis types and interfaces
 */
export * as initiating_event_analysis from './initiating-event-analysis/initiating-event-analysis';

/**
 * @namespace technical_elements.systems_analysis
 * @description Systems Analysis types and interfaces, including temporal modeling capabilities
 */
export * as systems_analysis from './systems-analysis/systems-analysis';

/**
 * @namespace technical_elements.risk_integration
 * @description Risk Integration types and interfaces
 */
export * as risk_integration from './risk-integration/risk-integration';

/**
 * @namespace technical_elements.event_sequence_analysis
 * @description Event Sequence Analysis types and interfaces
 */
export * as event_sequence_analysis from './event-sequence-analysis/event-sequence-analysis';

/**
 * @namespace technical_elements.success_criteria_development
 * @description Success Criteria Development types and interfaces
 */
export * as success_criteria_development from './success-criteria/success-criteria-development'; 

/**
 * @namespace technical_elements.event_sequence_quantification
 * @description Event Sequence Quantification types and interfaces
 */
export * as event_sequence_quantification from './event-sequence-quantification/event-sequence-quantification';

/**
 * @namespace technical_elements.mechanistic_source_term
 * @description Mechanistic Source Term types and interfaces
 */
export * as mechanistic_source_term from './mechanistic-source-term/mechanistic-source-term';

/**
 * @namespace technical_elements.radiological_consequence_analysis
 * @description Radiological Consequence Analysis types and interfaces
 */
export * as radiological_consequence_analysis from './radiological-consequence-analysis/radiological-consequence-analysis';

/**
 * @namespace technical_elements.integration
 * @description Integration interfaces for external tools and formats
 */
export * as integration from './integration';

// Direct exports for commonly used integration interfaces
export { 
  OpenPSASerializable, 
  OpenPSAFieldMapping,
  OpenPSASerializationOptions,
  DEFAULT_OPENPSA_SERIALIZATION_OPTIONS 
} from './integration/open-psa-serialization';

export {
  SAPHIREFieldMapping,
  SAPHIRECompatible
} from './integration/saphire-annotations';