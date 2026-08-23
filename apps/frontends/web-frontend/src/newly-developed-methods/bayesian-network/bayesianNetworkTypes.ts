import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";

interface BayesianNetworkFaultTreeOption {
  workbookId: string;
  workbookName: string;
  modelId: string;
  modelCode: string;
  modelName: string;
  basicEvents: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

interface BayesianNetworkEditorProps {
  model: BayesianNetworkModel;
  editable: boolean;
  evidence: BayesianNetworkEvidenceConfiguration;
  queryNodeId: string | null;
  validation: ValidationIssue[];
  analysisResult: BayesianNetworkAnalysisResult | null;
  running: boolean;
  runError: string | null;
  workbookId: string | null;
  hclConfigurations: EsqHclConfiguration[];
  faultTreeOptions: BayesianNetworkFaultTreeOption[];
  onModelChange: (model: BayesianNetworkModel) => void;
  onEvidenceChange: (evidence: BayesianNetworkEvidenceConfiguration) => void;
  onQueryNodeChange: (nodeId: string | null) => void;
  onHclConfigurationsChange: (configurations: EsqHclConfiguration[]) => void;
  onRun: () => void;
}

export type { BayesianNetworkEditorProps, BayesianNetworkFaultTreeOption };
