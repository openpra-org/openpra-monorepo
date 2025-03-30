/**
 * @module open_psa_serialization
 * @description Types and utilities for OpenPSA serialization to enable compatibility with tools that support the OpenPSA MEF standard.
 * 
 * The objectives of OpenPSA serialization ensure that:
 * - (a) OpenPRA models can be exported to OpenPSA format for compatibility with other tools
 * - (b) Field mappings between OpenPRA and OpenPSA are clearly defined and documented
 * - (c) Serialization options are configurable to meet different tool requirements
 * - (d) The serialization process is documented to provide traceability
 * 
 * @preferred
 * @category OpenPSA
 */

//==============================================================================
/**
 * @group OpenPSA
 * @description Basic types and interfaces used throughout the OpenPSA serialization module
 */
//==============================================================================

/**
 * Represents a mapping between OpenPRA fields and OpenPSA fields
 * @group OpenPSA
 */
export interface OpenPSAFieldMapping {
  /** OpenPRA field name */
  openPRAField: string;
  /** OpenPSA field name */
  openPSAField: string;
  /** Optional description of the mapping */
  description?: string;
}

/**
 * Interface for elements that can be serialized to OpenPSA format
 * @group OpenPSA
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
    /** Version of the OpenPSA format being used */
    formatVersion?: string;
    /** Type of model being serialized */
    modelType?: 'fault-tree' | 'event-tree' | 'reliability-block';
    /** Name of the model */
    modelName?: string;
  };
  
  /**
   * Extension points for OpenPSA specific attributes
   */
  openPSAAttributes?: Record<string, any>;
}


/**
 * @group OpenPSA
 * @description Configuration options for OpenPSA serialization
 */

/**
 * Options for OpenPSA serialization
 * @group OpenPSA
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
 * @group OpenPSA
 */
export const DEFAULT_OPENPSA_SERIALIZATION_OPTIONS: OpenPSASerializationOptions = {
  prettyPrint: true,
  includeComments: true,
  xmlVersion: '1.0'
};
