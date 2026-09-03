import type { BayesianNetworkDefinition } from "./bayesian-network";
import type { FaultTreeBasicEventCatalogueDefinition, FaultTreeDefinition } from "./fault-tree";
import type { HclConfigurationDefinition } from "./hybrid-causal-logic";
import type { WorkbookModelId } from "./shared";

interface WorkbookMethodModelIdentity {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

interface WorkbookFaultTree extends WorkbookMethodModelIdentity, FaultTreeDefinition {}

interface WorkbookBayesianNetwork extends WorkbookMethodModelIdentity, BayesianNetworkDefinition {}

interface WorkbookHclConfiguration extends WorkbookMethodModelIdentity, HclConfigurationDefinition {}

interface WorkbookFaultTreeCatalogue extends FaultTreeBasicEventCatalogueDefinition {}

export type {
  WorkbookBayesianNetwork,
  WorkbookHclConfiguration,
  WorkbookFaultTree,
  WorkbookFaultTreeCatalogue,
  WorkbookMethodModelIdentity,
};
