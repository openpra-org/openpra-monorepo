import type { ReactNode } from "react";
import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclCalculationType,
  HclHazardConvolutionResult,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

interface HclFaultTreeOption {
  workbookId: string;
  workbookName: string;
  modelId: string;
  modelCode: string;
  modelName: string;
  topGateId: string | null;
  basicEvents: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

interface HclEventTreeOption {
  workbookId: string;
  workbookName: string;
  modelId: string;
  modelCode: string;
  modelName: string;
  initiatingEventId?: string;
  plantOperatingStateId?: string;
  unlinkedFunctionalEventIds?: string[];
  sequences: Array<{ id: string; name: string; modelId?: string; modelName?: string; endStateName?: string }>;
  endStates?: Array<{ id: string; name: string }>;
  faultTrees: Array<{ workbookId: string; modelId: string }>;
  linkedFaultTrees?: Array<{
    workbookId: string;
    workbookName: string;
    modelId: string;
    modelCode: string;
    modelName: string;
    functionalEvents: Array<{ id: string; code: string; name: string; topGateId: string }>;
  }>;
}

type HclEditorRunResult =
  | { kind: "FAULT_TREE"; result: HclQuantificationResult }
  | { kind: "EVENT_TREE"; result: EventTreeAnalysisResult };

interface HclEditorScenarioRunResult {
  scenarioId: string;
  scenarioCode: string;
  scenarioName: string;
  status: string;
  failure: string | null;
  result: HclEditorRunResult | null;
}

interface HclEditorBatchRunResult {
  kind: "FAULT_TREE" | "EVENT_TREE";
  scenarios: HclEditorScenarioRunResult[];
  hazardConvolution?: HclHazardConvolutionResult;
}

type QuantificationWorkflow = "MANUAL" | "BATCH";

interface HclBindingEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  workbookId: string | null;
  configurations: WorkbookHclConfiguration[];
  faultTreeOptions: HclFaultTreeOption[];
  baseEvidence: BayesianNetworkEvidenceConfiguration;
  evidenceControl?: ReactNode;
  onChange: (configurations: WorkbookHclConfiguration[]) => void;
}

export type {
  HclBindingEditorProps,
  HclEditorRunResult,
  HclEditorBatchRunResult,
  HclEditorScenarioRunResult,
  HclCalculationType,
  QuantificationWorkflow,
  HclEventTreeOption,
  HclFaultTreeOption,
};
