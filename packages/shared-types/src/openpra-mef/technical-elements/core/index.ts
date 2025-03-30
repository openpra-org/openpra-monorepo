/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core types and interfaces for technical elements
 */

// Export meta types
export * from './meta';

// Export shared patterns
export * from './shared-patterns';

// Export documentation types
export * from './documentation';

// Export events
export * from './events';

// Export component types
export * from './component';

// Export quantification bridge
export * from './quantification-bridge';

// Export specific assumption types for easy access
export {
    BaseAssumption,
    PreOperationalAssumption,
    BasePreOperationalAssumptionsDocumentation
} from './documentation';

// Export model types
export { 
    ModelType, 
    defaultModelTypes, 
    getModelTypeById, 
    getModelTypeBySuffix 
  } from './model-types';