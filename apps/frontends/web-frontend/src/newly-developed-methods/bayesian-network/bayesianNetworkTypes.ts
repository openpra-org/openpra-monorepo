import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import type {
  HclEditorBatchRunResult,
  HclEditorRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "../hybrid-causal-logic";

type BayesianNetworkFaultTreeOption = HclFaultTreeOption;

interface BayesianNetworkEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  showAnalysis?: boolean;
  showQueryAnalysis?: boolean;
  showHclAnalysis?: boolean;
  hclScope?: "BOTH" | "FAULT_TREE" | "EVENT_TREE";
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeId: string | null;
  validation: ValidationIssue[];
  analysisResult: BayesianNetworkAnalysisResult | null;
  running: boolean;
  runError: string | null;
  workbookId: string | null;
  hclConfigurations: WorkbookHclConfiguration[];
  faultTreeOptions: BayesianNetworkFaultTreeOption[];
  eventTreeOptions: HclEventTreeOption[];
  hclRunning: boolean;
  hclRunError: string | null;
  hclRunResult: HclEditorRunResult | null;
  hclBatchRunResult: HclEditorBatchRunResult | null;
  onModelChange: (model: BayesianNetworkModel) => void;
  onEvidenceChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
  onQueryNodeChange: (nodeId: string | null) => void;
  onHclConfigurationsChange: (configurations: WorkbookHclConfiguration[]) => void;
  onRunHclFaultTree: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption) => void;
  onRunHclEventTree: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption) => void;
  onRunHclFaultTreeBatch: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, scenarioIds: string[], integrateHazardGrid: boolean) => void;
  onRunHclEventTreeBatch: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, scenarioIds: string[], integrateHazardGrid: boolean) => void;
  onRun: () => void;
}

export type { BayesianNetworkEditorProps, BayesianNetworkFaultTreeOption };
