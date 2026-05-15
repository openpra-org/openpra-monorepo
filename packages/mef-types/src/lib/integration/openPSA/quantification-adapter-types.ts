import { SystemsAnalysis as CoreSystemsAnalysis } from "../../systems-analysis/systems-analysis";
import { EventSequenceAnalysis as CoreEventSequenceAnalysis } from "../../event-sequence-analysis/event-sequence-analysis";
import { InitiatingEventsAnalysis as CoreInitiatingEventsAnalysis } from "../../initiating-event-analysis/initiating-event-analysis";
import { DistributionType, ProbabilityModel } from "../../data-analysis/data-analysis";
type StringRecord<T = any> = Record<string, T>;
export interface SystemBasicEvent {
  id: string;
  name?: string;
  description?: string;
  probability?: number;
  dataAnalysisBasicEventRef?: string;
  probabilityModel?: ProbabilityModel;
  expression?: {
    value?: number;
    parameter?: string;
    formula?: string;
    type?: "constant" | "parameter" | "formula";
  };
  unit?: string;
  attributes?: Array<{
    name: string;
    value: any;
  }>;
  role?: "public" | "private" | "interface";
}
export interface Parameter {
  id: string;
  name?: string;
  description?: string;
  value: any;
  unit?: string;
  dataAnalysisParameterRef?: string;
}
export interface Component {
  id: string;
  name?: string;
  description?: string;
  failureData?: {
    failureRate?: number;
    failureProbability?: number;
    timeUnit?: string;
    dataSource?: string;
    isPartOfCCFGroup?: boolean;
    ccfGroupReference?: string;
  };
  quantificationAttributes?: Array<{
    name: string;
    value: any;
  }>;
}
export interface Gate {
  id: string;
  name?: string;
  description?: string;
  type: string;
  inputs: Array<{
    id: string;
  }>;
  k?: number;
}
export interface FaultTree {
  id: string;
  name: string;
  gates: StringRecord<Gate>;
  components?: Component[];
  attributes?: Array<{
    name: string;
    value: any;
  }>;
}
export interface FunctionalEvent {
  id: string;
  name: string;
}
export interface Sequence {
  id: string;
  name: string;
}
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
export interface CCFFactor {
  level: number;
  value: number;
}
export interface CCFMember {
  id: string;
}
export interface CCFGroup {
  id: string;
  name: string;
  model: string;
  members: CCFMember[];
  totalProbability?: number;
  factors?: CCFFactor[];
  dataAnalysisCCFParameterRef?: string;
  probabilityModel?: ProbabilityModel;
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
export interface SystemsAnalysis {
  id: string;
  name: string;
  systemBasicEvents: StringRecord<SystemBasicEvent>;
  parameters: StringRecord<Parameter>;
  faultTrees: StringRecord<FaultTree>;
  commonCauseFailureGroups: StringRecord<CCFGroup>;
  dataAnalysisReference?: string;
  attributes?: Array<{
    name: string;
    value: any;
  }>;
}
export interface EventSequenceAnalysis {
  id: string;
  name: string;
  eventTrees: StringRecord<EventTree>;
}
export interface InitiatingEventsAnalysis {
  id: string;
  name: string;
}
export function isSystemsAnalysis(obj: any): obj is SystemsAnalysis {
  return obj && typeof obj === "object" && typeof obj.id === "string" && typeof obj.name === "string";
}
export function isEventSequenceAnalysis(obj: any): obj is EventSequenceAnalysis {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.eventTrees === "object"
  );
}
export function asSystemsAnalysis(obj: CoreSystemsAnalysis): SystemsAnalysis {
  return obj as unknown as SystemsAnalysis;
}
export function asEventSequenceAnalysis(obj: CoreEventSequenceAnalysis): EventSequenceAnalysis {
  return obj as unknown as EventSequenceAnalysis;
}
export function asInitiatingEventsAnalysis(obj: CoreInitiatingEventsAnalysis): InitiatingEventsAnalysis {
  return obj as unknown as InitiatingEventsAnalysis;
}
export function safeGet<T>(obj: any, key: string, defaultValue: T): T {
  if (obj && typeof obj === "object" && key in obj) {
    return obj[key] as T;
  }
  return defaultValue;
}
export function asRecord<T = any>(obj: any): Record<string, T> {
  if (obj && typeof obj === "object") {
    return obj as Record<string, T>;
  }
  return {};
}
