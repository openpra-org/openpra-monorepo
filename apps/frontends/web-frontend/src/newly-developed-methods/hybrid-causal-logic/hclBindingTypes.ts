import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclQuantificationResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
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
  modelName: string;
  sequences: Array<{ id: string; name: string }>;
  faultTrees: Array<{ workbookId: string; modelId: string }>;
}

type HclEditorRunResult =
  | { kind: "FAULT_TREE"; result: HclQuantificationResult }
  | { kind: "EVENT_TREE"; result: EventTreeAnalysisResult };

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
  onChange: (configurations: EsqHclConfiguration[]) => void;
  onRunFaultTree: (configuration: EsqHclConfiguration, faultTree: HclFaultTreeOption) => void;
  onRunEventTree: (configuration: EsqHclConfiguration, eventTree: HclEventTreeOption) => void;
}

export type {
  HclBindingEditorProps,
  HclEditorRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
};
