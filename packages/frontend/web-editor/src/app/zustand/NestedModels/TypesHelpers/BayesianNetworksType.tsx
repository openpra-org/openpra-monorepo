import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

/**
 * Actions for Bayesian Network nested models.
 */
export interface BayesianNetworksType {
  SetBayesianNetworks: (parentId: string) => Promise<void>;
  AddBayesianNetwork: (data: NestedModelJSON) => Promise<void>;
  EditBayesianNetwork: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteBayesianNetwork: (id: string) => Promise<void>;
}
