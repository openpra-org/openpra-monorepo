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

import { EventTree, EventTreeBranch, EventTreeSequence, FunctionalEvent } from "../event-sequence-analysis/event-sequence-analysis";

/**
 * Interface for objects that can be serialized to OpenPSA XML format.
 */
export interface OpenPSASerializable {
  /**
   * Serializes the object to OpenPSA XML format.
   * @returns The XML string representation.
   */
  toOpenPSAXML(): string;
  
  /**
   * Serializes an event tree to OpenPSA XML format.
   * @param eventTree - The event tree to serialize.
   * @returns The XML string representation of the event tree.
   */
  eventTreeToOpenPSAXML(eventTree: EventTree): string;
  
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
  
  /**
   * Whether to include event tree information in the serialization.
   */
  includeEventTrees?: boolean;
  
  /**
   * Format for event tree serialization.
   */
  eventTreeFormat?: "compact" | "verbose";
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

//==============================================================================
/**
 * @group OpenPSA
 * @description Functions and classes for serializing event trees to OpenPSA XML format
 */
//==============================================================================

/**
 * Options for event tree serialization
 * @group OpenPSA
 */
export interface EventTreeSerializationOptions {
  /** Format for serialization (compact or verbose) */
  format?: "compact" | "verbose";
  
  /** Whether to include attributes */
  includeAttributes?: boolean;
  
  /** Indentation for pretty printing */
  indent?: number;
  
  /** XML version */
  xmlVersion?: string;
}

/**
 * Default options for event tree serialization
 * @group OpenPSA
 */
export const DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS: EventTreeSerializationOptions = {
  format: "verbose",
  includeAttributes: true,
  indent: 2,
  xmlVersion: "1.0"
};

/**
 * Helper class for serializing event trees to OpenPSA XML format
 * @group OpenPSA
 */
export class EventTreeSerializer {
  /**
   * Serializes an event tree to OpenPSA XML format
   * @param eventTree - The event tree to serialize
   * @param options - Serialization options
   * @returns The XML string representation
   */
  static serializeEventTree(
    eventTree: EventTree, 
    options: EventTreeSerializationOptions = DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS
  ): string {
    const { format, includeAttributes, indent, xmlVersion } = {
      ...DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS,
      ...options
    };
    
    // Create indentation string
    const tab = " ".repeat(indent || 2);
    
    // Start with XML declaration
    let xml = `<?xml version="${xmlVersion}" encoding="UTF-8"?>\n`;
    
    // Define event tree
    xml += `<define-event-tree name="${eventTree.name}">\n`;
    
    // Add label if available
    if (eventTree.label && includeAttributes) {
      xml += `${tab}<label>${eventTree.label}</label>\n`;
    }
    
    // Add attributes if available
    if (includeAttributes && eventTree.description) {
      xml += `${tab}<attributes>\n`;
      xml += `${tab}${tab}<attribute name="description">${eventTree.description}</attribute>\n`;
      
      if (eventTree.initiatingEventId) {
        xml += `${tab}${tab}<attribute name="initiating-event">${eventTree.initiatingEventId}</attribute>\n`;
      }
      
      if (eventTree.missionTime) {
        xml += `${tab}${tab}<attribute name="mission-time">${eventTree.missionTime}</attribute>\n`;
      }
      
      xml += `${tab}</attributes>\n`;
    }
    
    // Add functional events
    Object.values(eventTree.functionalEvents).forEach(funcEvent => {
      xml += this.serializeFunctionalEvent(funcEvent, tab);
    });
    
    // Add sequences
    Object.values(eventTree.sequences).forEach(sequence => {
      xml += this.serializeSequence(sequence, tab);
    });
    
    // Add branches
    Object.values(eventTree.branches).forEach(branch => {
      xml += this.serializeBranch(branch, tab, eventTree);
    });
    
    // Add initial state
    xml += `${tab}<initial-state>\n`;
    
    const initialBranch = eventTree.branches[eventTree.initialState.branchId];
    if (initialBranch) {
      xml += this.serializeBranchContent(initialBranch, `${tab}${tab}`, eventTree);
    } else {
      xml += `${tab}${tab}<!-- Error: Initial branch not found -->\n`;
    }
    
    xml += `${tab}</initial-state>\n`;
    
    // Close event tree definition
    xml += `</define-event-tree>\n`;
    
    return xml;
  }
  
  /**
   * Serializes a functional event to OpenPSA XML format
   * @param functionalEvent - The functional event to serialize
   * @param indent - Indentation string
   * @returns The XML string representation
   */
  private static serializeFunctionalEvent(functionalEvent: FunctionalEvent, indent: string): string {
    let xml = `${indent}<define-functional-event name="${functionalEvent.name}">\n`;
    
    if (functionalEvent.label) {
      xml += `${indent}${indent}<label>${functionalEvent.label}</label>\n`;
    }
    
    if (functionalEvent.description || functionalEvent.systemReference || functionalEvent.humanActionReference) {
      xml += `${indent}${indent}<attributes>\n`;
      
      if (functionalEvent.description) {
        xml += `${indent}${indent}${indent}<attribute name="description">${functionalEvent.description}</attribute>\n`;
      }
      
      if (functionalEvent.systemReference) {
        xml += `${indent}${indent}${indent}<attribute name="system-reference">${functionalEvent.systemReference}</attribute>\n`;
      }
      
      if (functionalEvent.humanActionReference) {
        xml += `${indent}${indent}${indent}<attribute name="human-action-reference">${functionalEvent.humanActionReference}</attribute>\n`;
      }
      
      if (functionalEvent.order !== undefined) {
        xml += `${indent}${indent}${indent}<attribute name="order">${functionalEvent.order}</attribute>\n`;
      }
      
      xml += `${indent}${indent}</attributes>\n`;
    }
    
    xml += `${indent}</define-functional-event>\n`;
    
    return xml;
  }
  
  /**
   * Serializes a sequence to OpenPSA XML format
   * @param sequence - The sequence to serialize
   * @param indent - Indentation string
   * @returns The XML string representation
   */
  private static serializeSequence(sequence: EventTreeSequence, indent: string): string {
    let xml = `${indent}<define-sequence name="${sequence.name}">\n`;
    
    if (sequence.label) {
      xml += `${indent}${indent}<label>${sequence.label}</label>\n`;
    }
    
    if (sequence.instructions && sequence.instructions.length > 0) {
      sequence.instructions.forEach(instruction => {
        xml += `${indent}${indent}<instruction>${instruction}</instruction>\n`;
      });
    }
    
    if (sequence.endState || sequence.eventSequenceId || sequence.functionalEventStates) {
      xml += `${indent}${indent}<attributes>\n`;
      
      if (sequence.endState) {
        xml += `${indent}${indent}${indent}<attribute name="end-state">${sequence.endState}</attribute>\n`;
      }
      
      if (sequence.eventSequenceId) {
        xml += `${indent}${indent}${indent}<attribute name="event-sequence-id">${sequence.eventSequenceId}</attribute>\n`;
      }
      
      if (sequence.functionalEventStates) {
        Object.entries(sequence.functionalEventStates).forEach(([eventId, state]) => {
          xml += `${indent}${indent}${indent}<attribute name="state-${eventId}">${state}</attribute>\n`;
        });
      }
      
      xml += `${indent}${indent}</attributes>\n`;
    }
    
    xml += `${indent}</define-sequence>\n`;
    
    return xml;
  }
  
  /**
   * Serializes a branch to OpenPSA XML format
   * @param branch - The branch to serialize
   * @param indent - Indentation string
   * @param eventTree - The parent event tree (for references)
   * @returns The XML string representation
   */
  private static serializeBranch(branch: EventTreeBranch, indent: string, eventTree: EventTree): string {
    let xml = `${indent}<define-branch name="${branch.name}">\n`;
    
    if (branch.label) {
      xml += `${indent}${indent}<label>${branch.label}</label>\n`;
    }
    
    xml += `${indent}${indent}<branch>\n`;
    xml += this.serializeBranchContent(branch, `${indent}${indent}${indent}`, eventTree);
    xml += `${indent}${indent}</branch>\n`;
    
    xml += `${indent}</define-branch>\n`;
    
    return xml;
  }
  
  /**
   * Serializes the content of a branch to OpenPSA XML format
   * @param branch - The branch to serialize
   * @param indent - Indentation string
   * @param eventTree - The parent event tree (for references)
   * @returns The XML string representation
   */
  private static serializeBranchContent(branch: EventTreeBranch, indent: string, eventTree: EventTree): string {
    let xml = "";
    
    // Add functional event if defined
    if (branch.functionalEventId) {
      const funcEvent = eventTree.functionalEvents[branch.functionalEventId];
      if (funcEvent) {
        xml += `${indent}<test-functional-event name="${funcEvent.name}">\n`;
      } else {
        xml += `${indent}<test-functional-event name="${branch.functionalEventId}">\n`;
      }
      
      // Add paths
      branch.paths.forEach(path => {
        let targetXml = "";
        
        if (path.targetType === "BRANCH") {
          targetXml = `<branch name="${path.target}"/>`;
        } else if (path.targetType === "SEQUENCE") {
          targetXml = `<sequence name="${path.target}"/>`;
        } else if (path.targetType === "END_STATE") {
          targetXml = `<end-state>${path.target}</end-state>`;
        }
        
        xml += `${indent}${indent}<${path.state.toLowerCase()}>${targetXml}</${path.state.toLowerCase()}>\n`;
      });
      
      xml += `${indent}</test-functional-event>\n`;
    } else {
      // If no functional event, just add direct paths (unusual case)
      branch.paths.forEach(path => {
        let targetXml = "";
        
        if (path.targetType === "BRANCH") {
          targetXml = `<branch name="${path.target}"/>`;
        } else if (path.targetType === "SEQUENCE") {
          targetXml = `<sequence name="${path.target}"/>`;
        } else if (path.targetType === "END_STATE") {
          targetXml = `${path.target}`;
        }
        
        xml += `${indent}<${path.state.toLowerCase()}>${targetXml}</${path.state.toLowerCase()}>\n`;
      });
    }
    
    return xml;
  }
}

/**
 * Default instance of EventTreeSerializer for convenient use throughout the application
 * @group OpenPSA
 */
export const defaultEventTreeSerializer = new EventTreeSerializer();

/**
 * Helper function to convert event trees to OpenPSA XML using the default serializer
 * @param eventTree - The event tree to serialize
 * @param options - Optional serialization options
 * @returns XML string representation of the event tree
 * @group OpenPSA
 */
export function eventTreeToOpenPSAXML(
  eventTree: EventTree,
  options?: EventTreeSerializationOptions
): string {
  return EventTreeSerializer.serializeEventTree(eventTree, options);
}

/**
 * Helper function to map OpenPSA serialization options to event tree serialization options
 * @param options - OpenPSA serialization options
 * @returns Equivalent event tree serialization options
 * @group OpenPSA
 */
export function mapToEventTreeOptions(options: OpenPSASerializationOptions): EventTreeSerializationOptions {
  return {
    format: options.eventTreeFormat || "verbose",
    includeAttributes: true,
    indent: options.prettyPrint ? 2 : 0,
    xmlVersion: options.xmlVersion || "1.0"
  };
}
