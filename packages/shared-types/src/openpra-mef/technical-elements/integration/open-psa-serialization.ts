/**
 * OpenPSA Serialization Types and Utilities
 * 
 * This module provides types and utilities for OpenPSA serialization
 * to enable compatibility with tools that support the OpenPSA MEF standard.
 */

/**
 * Represents a mapping between OpenPRA fields and OpenPSA fields
 */
export interface OpenPSAFieldMapping {
  openPRAField: string;
  openPSAField: string;
  description?: string;
}

/**
 * Interface for elements that can be serialized to OpenPSA format
 */
export interface OpenPSASerializable {
  /**
   * Convert the element to OpenPSA XML format
   */
  toOpenPSAXml(): string;
  
  /**
   * Field mappings between OpenPRA and OpenPSA
   */
  openPSAFieldMappings?: Record<string, string>;
  
  /**
   * Metadata for OpenPSA format
   */
  openPSAMetadata?: {
    formatVersion?: string;
    modelType?: 'fault-tree' | 'event-tree' | 'reliability-block';
    modelName?: string;
  };
  
  /**
   * Extension points for OpenPSA specific attributes
   */
  openPSAAttributes?: Record<string, any>;
}

/**
 * Options for OpenPSA serialization
 */
export interface OpenPSASerializationOptions {
  /**
   * Format the XML output for readability
   */
  prettyPrint?: boolean;
  
  /**
   * Include comments in the XML output
   */
  includeComments?: boolean;
  
  /**
   * XML version to use
   */
  xmlVersion?: string;
}

/**
 * Default serialization options
 */
export const DEFAULT_OPENPSA_SERIALIZATION_OPTIONS: OpenPSASerializationOptions = {
  prettyPrint: true,
  includeComments: true,
  xmlVersion: '1.0'
};
