/**
 * @module quantification_adapter_types
 * @description Type definitions for the quantification adapter
 * 
 * This module provides type definitions to be used with the quantification adapter.
 * These types shadow the official OpenPRA types to bridge the gap between
 * the TypeScript definitions and the actual runtime objects, without modifying OpenPRA's core schema.
 */

// Import original types as references, but don't extend them directly
import { SystemsAnalysis as CoreSystemsAnalysis } from '../../systems-analysis/systems-analysis';
import { EventSequenceAnalysis as CoreEventSequenceAnalysis } from '../../event-sequence-analysis/event-sequence-analysis';
import { InitiatingEventsAnalysis as CoreInitiatingEventsAnalysis } from '../../initiating-event-analysis/initiating-event-analysis';
import { DistributionType, ProbabilityModel } from '../../data-analysis/data-analysis';

/**
 * Generic Record type with string keys and any values
 * @group SCRAM Adapter
 */
type StringRecord<T = any> = Record<string, T>;

/**
 * Interface for basic events used by the adapter
 * @group SCRAM Adapter
 */
export interface SystemBasicEvent {
  id: string;
  name?: string;
  description?: string;
  probability?: number;
  
  /**
   * Reference to a component basic event in the data analysis module
   */
  dataAnalysisBasicEventRef?: string;
  
  /**
   * Probability model (imported from Data Analysis module)
   */
  probabilityModel?: ProbabilityModel;
  
  /**
   * Expression for probability calculation
   * @deprecated Use probabilityModel from data-analysis module instead
   */
  expression?: {
    value?: number;
    parameter?: string;
    formula?: string;
    type?: "constant" | "parameter" | "formula";
  };
  
  /**
   * Unit for the probability/frequency value
   */
  unit?: string;
  
  /**
   * Attributes for passing additional information to the quantification engine
   */
  attributes?: Array<{ name: string; value: any }>;
  
  /**
   * Role of this basic event in quantification
   */
  role?: "public" | "private" | "interface";
}

/**
 * Interface for parameters used by the adapter
 * @group SCRAM Adapter
 */
export interface Parameter {
  id: string;
  name?: string;
  description?: string;
  value: any;
  unit?: string;
  
  /**
   * Reference to a parameter in the data analysis module
   */
  dataAnalysisParameterRef?: string;
}

/**
 * Interface for components used by the adapter
 * @group SCRAM Adapter
 */
export interface Component {
  id: string;
  name?: string;
  description?: string;
  
  /**
   * Failure data for quantification
   */
  failureData?: {
    failureRate?: number;
    failureProbability?: number;
    timeUnit?: string;
    dataSource?: string;
    isPartOfCCFGroup?: boolean;
    ccfGroupReference?: string;
  };
  
  /**
   * Quantification attributes
   */
  quantificationAttributes?: Array<{
    name: string;
    value: any;
  }>;
}

/**
 * Interface for gates in fault trees used by the adapter
 * @group SCRAM Adapter
 */
export interface Gate {
  id: string;
  name?: string;
  description?: string;
  type: string;
  inputs: Array<{ id: string }>;
  k?: number; // For ATLEAST gates
}

/**
 * Interface for fault trees used by the adapter
 * @group SCRAM Adapter
 */
export interface FaultTree {
  id: string;
  name: string;
  gates: StringRecord<Gate>;
  components?: Component[];
  
  /**
   * Attributes for quantification adapter
   */
  attributes?: Array<{ name: string; value: any }>;
}

/**
 * Interface for functional events in event trees used by the adapter
 * @group SCRAM Adapter
 */
export interface FunctionalEvent {
  id: string;
  name: string;
}

/**
 * Interface for sequences in event trees used by the adapter
 * @group SCRAM Adapter
 */
export interface Sequence {
  id: string;
  name: string;
}

/**
 * Interface for event trees used by the adapter
 * @group SCRAM Adapter
 */
export interface EventTree {
  id: string;
  name: string;
  functionalEvents: StringRecord<FunctionalEvent>;
  sequences: StringRecord<Sequence>;
  initialState?: {
    branchId: string;
  };
  branches?: StringRecord<any>;
}

/**
 * Interface for CCF group factors used by the adapter
 * @group SCRAM Adapter
 */
export interface CCFFactor {
  level: number;
  value: number;
}

/**
 * Interface for CCF group members used by the adapter
 * @group SCRAM Adapter
 */
export interface CCFMember {
  id: string;
}

/**
 * Interface for common cause failure groups used by the adapter
 * @group SCRAM Adapter
 */
export interface CCFGroup {
  id: string;
  name: string;
  model: string;
  members: CCFMember[];
  totalProbability?: number;
  factors?: CCFFactor[];
  
  /**
   * Reference to CCF parameter in data analysis module
   */
  dataAnalysisCCFParameterRef?: string;
  
  /**
   * Probability model from data analysis module
   */
  probabilityModel?: ProbabilityModel;
  
  /**
   * Model-specific parameters based on the modelType
   */
  modelSpecificParameters?: {
    betaFactorParameters?: {
      beta: number;
      totalFailureProbability: number;
    };
    mglParameters?: {
      beta: number;
      gamma?: number;
      delta?: number;
      additionalFactors?: Record<string, number>;
      totalFailureProbability: number;
    };
    alphaFactorParameters?: {
      alphaFactors: Record<string, number>;
      totalFailureProbability: number;
    };
    phiFactorParameters?: {
      phiFactors: Record<string, number>;
      totalFailureProbability: number;
    };
  };
}

/**
 * SystemsAnalysis interface used by the adapter
 * This shadows the original interface without extending it
 * @group SCRAM Adapter
 */
export interface SystemsAnalysis {
  // Core properties needed by the adapter
  id: string;
  name: string;
  
  // Collections
  systemBasicEvents: StringRecord<SystemBasicEvent>;
  parameters: StringRecord<Parameter>;
  faultTrees: StringRecord<FaultTree>;
  commonCauseFailureGroups: StringRecord<CCFGroup>;
  
  /**
   * Reference to associated Data Analysis module
   */
  dataAnalysisReference?: string;
  
  /**
   * Attributes for the quantification adapter
   */
  attributes?: Array<{ name: string; value: any }>;
  
  // Original properties from CoreSystemsAnalysis may exist
  // but we only define what the adapter needs
}

/**
 * EventSequenceAnalysis interface used by the adapter
 * This shadows the original interface without extending it
 * @group SCRAM Adapter
 */
export interface EventSequenceAnalysis {
  // Core properties needed by the adapter
  id: string;
  name: string;
  
  // Collections
  eventTrees: StringRecord<EventTree>;
  
  // Original properties from CoreEventSequenceAnalysis may exist
  // but we only define what the adapter needs
}

/**
  *InitiatingEventsAnalysis interface used by the adapter
 * This shadows the original interface without extending it
 * @group SCRAM Adapter
 */
export interface InitiatingEventsAnalysis {
  id: string;
  name: string;
}

/**
 * Type guard to check if an object can be used as SystemsAnalysis for the adapter
 * @param obj - Object to check
 * @returns Whether the object is compatible with the adapter's SystemsAnalysis
 * @group SCRAM Adapter
 */
export function isSystemsAnalysis(obj: any): obj is SystemsAnalysis {
  return obj && 
    typeof obj === 'object' && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string';
}

/**
 * Type guard to check if an object can be used as EventSequenceAnalysis for the adapter
 * @param obj - Object to check
 * @returns Whether the object is compatible with the adapter's EventSequenceAnalysis
 * @group SCRAM Adapter
 */
export function isEventSequenceAnalysis(obj: any): obj is EventSequenceAnalysis {
  return obj && 
    typeof obj === 'object' && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' && 
    typeof obj.eventTrees === 'object';
}

/**
 * Adapter-specific type cast for SystemsAnalysis
 * @param obj - The original SystemsAnalysis object
 * @returns The object cast to the adapter's SystemsAnalysis interface
 * @group SCRAM Adapter
 */
export function asSystemsAnalysis(obj: CoreSystemsAnalysis): SystemsAnalysis {
  return obj as unknown as SystemsAnalysis;
}

/**
 * Adapter-specific type cast for EventSequenceAnalysis
 * @param obj - The original EventSequenceAnalysis object
 * @returns The object cast to the adapter's EventSequenceAnalysis interface
 * @group SCRAM Adapter
 */
export function asEventSequenceAnalysis(obj: CoreEventSequenceAnalysis): EventSequenceAnalysis {
  return obj as unknown as EventSequenceAnalysis;
}

/**
 * Adapter-specific type cast for InitiatingEventsAnalysis
 * @param obj - The original InitiatingEventsAnalysis object
 * @returns The object cast to the adapter's InitiatingEventsAnalysis interface
 * @group SCRAM Adapter
 */
export function asInitiatingEventsAnalysis(obj: CoreInitiatingEventsAnalysis): InitiatingEventsAnalysis {
  return obj as unknown as InitiatingEventsAnalysis;
}

/**
 * Helper function to safely access a property from an object that might not have TypeScript definitions
 * @param obj - The object to access
 * @param key - The property key
 * @param defaultValue - Default value if property doesn't exist
 * @returns The property value or default value
 * @group SCRAM Adapter
 */
export function safeGet<T>(obj: any, key: string, defaultValue: T): T {
  if (obj && typeof obj === 'object' && key in obj) {
    return obj[key] as T;
  }
  return defaultValue;
}

/**
 * Helper function to safely convert a possibly undefined object to a record
 * @param obj - The object to convert
 * @returns The object as a record or an empty object
 * @group SCRAM Adapter
 */
export function asRecord<T = any>(obj: any): Record<string, T> {
  if (obj && typeof obj === 'object') {
    return obj as Record<string, T>;
  }
  return {};
} 