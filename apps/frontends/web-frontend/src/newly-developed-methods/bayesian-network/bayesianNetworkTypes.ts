import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import type {
  HclEditorRunResult,
  HclEventTreeOption,
  HclFaultTreeOption,
} from "../hybrid-causal-logic";

type BayesianNetworkFaultTreeOption = HclFaultTreeOption;

interface BayesianNetworkEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  showAnalysis?: boolean;
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeId: string | null;
  validation: ValidationIssue[];
  analysisResult: BayesianNetworkAnalysisResult | null;
  running: boolean;
  runError: string | null;
  workbookId: string | null;
  hclConfigurations: EsqHclConfiguration[];
  faultTreeOptions: BayesianNetworkFaultTreeOption[];
  eventTreeOptions: HclEventTreeOption[];
  hclRunning: boolean;
  hclRunError: string | null;
  hclRunResult: HclEditorRunResult | null;
  onModelChange: (model: BayesianNetworkModel) => void;
  onEvidenceChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
  onQueryNodeChange: (nodeId: string | null) => void;
  onHclConfigurationsChange: (configurations: EsqHclConfiguration[]) => void;
  onRunHclFaultTree: (configuration: EsqHclConfiguration, faultTree: HclFaultTreeOption) => void;
  onRunHclEventTree: (configuration: EsqHclConfiguration, eventTree: HclEventTreeOption) => void;
  onRun: () => void;
}

export type { BayesianNetworkEditorProps, BayesianNetworkFaultTreeOption };
