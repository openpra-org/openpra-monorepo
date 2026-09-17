import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type { ReactNode } from "react";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclCalculationType,
  HclBatchCompilationStats,
  HclEvidenceScenario,
  HclHazardConvolutionResult,
  HclHazardSweepSpec,
  HclQuantificationResult,
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
}

interface HclEventTreeOption {
  workbookId: string;
  workbookName: string;
  modelId: string;
  modelCode: string;
  modelName: string;
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
  compilationReuse?: HclBatchCompilationStats;
}

type QuantificationWorkflow = "MANUAL" | "BATCH";

interface HclBindingEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  workbookId: string | null;
  configurations: WorkbookHclConfiguration[];
  scope?: "BOTH" | "FAULT_TREE" | "EVENT_TREE";
  faultTreeOptions: HclFaultTreeOption[];
  eventTreeOptions: HclEventTreeOption[];
  baseEvidence: BayesianNetworkEvidenceConfiguration;
  validation: ValidationIssue[];
  quantificationBlocked?: boolean;
  running: boolean;
  saveBlockedReason?: string | null;
  onAnalysisInputChange?: () => void;
  runError: string | null;
  runResult: HclEditorRunResult | null;
  batchRunResult: HclEditorBatchRunResult | null;
  evidenceEditorOpen?: boolean;
  evidenceEditor?: ReactNode;
  calculationType?: HclCalculationType;
  workflow?: QuantificationWorkflow;
  onGenerateScenarios?: (configuration: WorkbookHclConfiguration, spec: HclHazardSweepSpec) => Promise<HclEvidenceScenario[]>;
  onEditEvidence?: () => void;
  onChange: (configurations: WorkbookHclConfiguration[]) => void;
  onRunFaultTree: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, calculationType: HclCalculationType) => void;
  onRunEventTree: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, calculationType: HclCalculationType) => void;
  onRunFaultTreeBatch: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, scenarioIds: string[], integrateHazardGrid: boolean, calculationType: HclCalculationType) => void;
  onRunEventTreeBatch: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, scenarioIds: string[], integrateHazardGrid: boolean, calculationType: HclCalculationType) => void;
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
