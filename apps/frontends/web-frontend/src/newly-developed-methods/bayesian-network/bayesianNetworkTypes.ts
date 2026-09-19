import type { HclBindingEditorProps } from "../hybrid-causal-logic/hclBindingTypes";
import type {
  BayesianNetworkEvidenceConfiguration,
  HclEvidenceScenario,
  WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkBatchRow,
  BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import type {
  HclEditorBatchRunResult,
  HclEditorRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
  HclCalculationType,
} from "../hybrid-causal-logic";

type BayesianNetworkFaultTreeOption = HclFaultTreeOption;

type BayesianNetworkQueryBatchRow = BayesianNetworkBatchRow;

interface BayesianNetworkQueryBatchResult {
  queryNodeId: string;
  scenarios: BayesianNetworkQueryBatchRow[];
}

interface BayesianNetworkEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  readOnlyNotice?: { message: string; sourceHref?: string; sourceLabel?: string };
  workbookNotice?: { message: string; sourceHref?: string; sourceLabel?: string };
  showAnalysis?: boolean;
  showQueryAnalysis?: boolean;
  showHclAnalysis?: boolean;
  hclScope?: "BOTH" | "FAULT_TREE" | "EVENT_TREE";
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeId: string | null;
  validation: ValidationIssue[];
  analysisResult: BayesianNetworkAnalysisResult | null;
  queryBatchResult?: BayesianNetworkQueryBatchResult | null;
  running: boolean;
  saveBlockedReason?: string | null;
  onAnalysisInputChange?: () => void;
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
  onGenerateHclScenarios?: HclBindingEditorProps["onGenerateScenarios"];
  onRunHclFaultTree: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, calculationType: HclCalculationType) => void;
  onRunHclEventTree: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, calculationType: HclCalculationType) => void;
  onRunHclFaultTreeBatch: (configuration: WorkbookHclConfiguration, faultTree: HclFaultTreeOption, scenarioIds: string[], integrateHazardGrid: boolean, calculationType: HclCalculationType) => void;
  onRunHclEventTreeBatch: (configuration: WorkbookHclConfiguration, eventTree: HclEventTreeOption, scenarioIds: string[], integrateHazardGrid: boolean, calculationType: HclCalculationType) => void;
  onRun: () => void;
  onRunBatch?: (scenarios: HclEvidenceScenario[]) => void;
}

export type {
  BayesianNetworkEditorProps,
  BayesianNetworkFaultTreeOption,
  BayesianNetworkQueryBatchResult,
  BayesianNetworkQueryBatchRow,
};
