/**
 * @module integration
 * @description Integration interfaces for external tools and formats
 * 
 * This module provides interfaces and types for integrating OpenPRA with 
 * external tools and formats such as OpenPSA and SAPHIRE.
 */

// Export OpenPSA serialization interfaces
export * from './openPSA/openPSA-xml-serialization';

// Export SAPHIRE integration interfaces
export * from './SAPHIRE/saphire-annotations';

// Export quantification adapter and types for third-party quantification tools
export * from './openPSA/quantification-adapter';
export * from './openPSA/quantification-adapter-types';
export * from './openPSA/scram-quantification-input';

// Re-export specific SAPHIRE types for convenience
export {
  SaphireFieldMapping,
  SaphireCompatible,
  SaphirePhase,
  SaphireProjectAttributes,
  phaseSaphireMappings,
  specialEventSaphireMappings,
  projectAttributesSaphireMappings,
  // New SAPHIRE exports
  SaphireFaultTree,
  faultTreeSaphireMappings,
  SaphireGate,
  gateSaphireMappings,
  SaphireEventTree,
  eventTreeSaphireMappings,
  SaphireSequence,
  sequenceSaphireMappings,
  SaphireBasicEvent,
  basicEventSaphireMappings,
  SaphireCCF,
  ccfSaphireMappings,
  SaphireEndState,
  endStateSaphireMappings,
  SaphireHistogram,
  histogramSaphireMappings
} from './SAPHIRE/saphire-annotations'; 