/**
 * @packageDocumentation
 * @module radiological_consequence_analysis
 * @description OpenPRA Radiological Consequence Analysis - Types and interfaces for radiological consequence analysis elements
 */

// Direct exports from the main module
export * from "./radiological-consequence-analysis";

// Export additional reference interfaces from references module
export {
  RiskSignificantConsequence,
  // Re-export mechanistic source term types
  ReleaseCategoryReference,
  SourceTermDefinitionReference,
  EventSequenceToReleaseCategoryMapping,
  ReleaseCategory,
  SourceTermDefinition,
} from "./references";
