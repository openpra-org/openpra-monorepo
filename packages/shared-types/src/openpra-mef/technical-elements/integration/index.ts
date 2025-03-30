/**
 * @module integration
 * @description Integration interfaces for external tools and formats
 * 
 * This module provides interfaces and types for integrating OpenPRA with 
 * external tools and formats such as OpenPSA and SAPHIRE.
 */

// Export OpenPSA serialization interfaces
export * from './open-psa-serialization';

// Export SAPHIRE integration interfaces
export * from './saphire-annotations';

// Re-export specific SAPHIRE types for convenience
export {
  SaphireFieldMapping,
  SaphireCompatible,
  SaphirePhase,
  SaphireProjectAttributes,
  phaseSaphireMappings,
  specialEventSaphireMappings,
  projectAttributesSaphireMappings
} from './saphire-annotations'; 