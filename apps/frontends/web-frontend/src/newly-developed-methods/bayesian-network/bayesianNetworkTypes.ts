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
import type { HclFaultTreeOption } from "../hybrid-causal-logic";

type BayesianNetworkFaultTreeOption = HclFaultTreeOption;

type BayesianNetworkQueryBatchRow = BayesianNetworkBatchRow;

interface BayesianNetworkQueryBatchResult {
  queryNodeId: string;
  scenarios: BayesianNetworkQueryBatchRow[];
}

interface BayesianNetworkEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeId: string | null;
  validation: ValidationIssue[];
  analysisResult: BayesianNetworkAnalysisResult | null;
  queryBatchResult?: BayesianNetworkQueryBatchResult | null;
  running: boolean;
  saveBlockedReason?: string | null;
  saving?: boolean;
  onAnalysisInputChange?: () => void;
  runError: string | null;
  workbookId: string | null;
  hclConfigurations: WorkbookHclConfiguration[];
  faultTreeOptions: BayesianNetworkFaultTreeOption[];
  onModelChange: (model: BayesianNetworkModel) => void;
  onModelImport: (model: BayesianNetworkModel) => void;
  onEvidenceChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
  onQueryNodeChange: (nodeId: string | null) => void;
  onHclConfigurationsChange: (configurations: WorkbookHclConfiguration[]) => void;
  onRun: () => void;
  onRunBatch?: (scenarios: HclEvidenceScenario[]) => void;
  onBuildFromSpecification?: (format: "JSON" | "YAML", source: string) => Promise<string>;
}

export type {
  BayesianNetworkEditorProps,
  BayesianNetworkFaultTreeOption,
  BayesianNetworkQueryBatchResult,
  BayesianNetworkQueryBatchRow,
};
