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

interface WorkbookHclConfiguration extends WorkbookMethodModelIdentity, Omit<HclConfigurationDefinition, "solverSettings"> {
  solverSettings: Omit<HclConfigurationDefinition["solverSettings"], "uncertainty"> & {
    /** Saved draft data; validate only when executing or editing uncertainty. */
    uncertainty?: unknown;
  };
}

interface WorkbookFaultTreeCatalogue extends FaultTreeBasicEventCatalogueDefinition {}

export type {
  WorkbookBayesianNetwork,
  WorkbookHclConfiguration,
  WorkbookFaultTree,
  WorkbookFaultTreeCatalogue,
  WorkbookMethodModelIdentity,
};
