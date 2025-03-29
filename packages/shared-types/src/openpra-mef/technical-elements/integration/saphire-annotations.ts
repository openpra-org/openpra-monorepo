/**
 * SAPHIRE integration types and interfaces
 * 
 * Provides types and interfaces for SAPHIRE compatibility
 */

/**
 * Represents a mapping between OpenPRA fields and SAPHIRE fields
 */
export interface SAPHIREFieldMapping {
  openPRAField: string;
  saphireField: string;
  description?: string;
}

/**
 * Interface for elements that are compatible with SAPHIRE format
 */
export interface SAPHIRECompatible {
  // Field mappings
  saphireFieldMappings?: SAPHIREFieldMapping[];
  
  // OpenPSA/SCRAM compatibility
  openPSAFieldMappings?: Record<string, string>;
}
