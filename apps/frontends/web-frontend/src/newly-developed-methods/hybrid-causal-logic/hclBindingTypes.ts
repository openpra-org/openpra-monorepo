import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclHazardConvolutionResult,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type {
  HclBatchFaultTreeGate,
  HclBatchFaultTreeGateInput,
  HclBatchFaultTreeLeaf,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";

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
  gates: HclBatchFaultTreeGate[];
  leafNodes: HclBatchFaultTreeLeaf[];
  gateInputs: HclBatchFaultTreeGateInput[];
  constantBasicEventStates: Record<string, boolean>;
}

interface HclEventTreeOption {
  workbookId: string;
  workbookName: string;
  modelId: string;
  modelName: string;
  sequences: Array<{ id: string; name: string }>;
  faultTrees: Array<{ workbookId: string; modelId: string }>;
  transferTargets: Array<{ workbookId: string; modelId: string }>;
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

interface HclBindingEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  workbookId: string | null;
  configurations: EsqHclConfiguration[];
  faultTreeOptions: HclFaultTreeOption[];
  eventTreeOptions: HclEventTreeOption[];
  baseEvidence: BayesianNetworkEvidenceConfiguration;
  validation: ValidationIssue[];
  running: boolean;
  runError: string | null;
  runResult: HclEditorRunResult | null;
  batchRunResult: HclEditorBatchRunResult | null;
  onChange: (configurations: EsqHclConfiguration[]) => void;
  onRunFaultTree: (configuration: EsqHclConfiguration, faultTree: HclFaultTreeOption) => void;
  onRunEventTree: (configuration: EsqHclConfiguration, eventTree: HclEventTreeOption) => void;
  onRunFaultTreeBatch: (configuration: EsqHclConfiguration, faultTree: HclFaultTreeOption, scenarioIds: string[], integrateHazardGrid: boolean) => void;
  onRunEventTreeBatch: (configuration: EsqHclConfiguration, eventTree: HclEventTreeOption, scenarioIds: string[], integrateHazardGrid: boolean) => void;
}

export type {
  HclBindingEditorProps,
  HclEditorRunResult,
  HclEditorBatchRunResult,
  HclEditorScenarioRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
};
