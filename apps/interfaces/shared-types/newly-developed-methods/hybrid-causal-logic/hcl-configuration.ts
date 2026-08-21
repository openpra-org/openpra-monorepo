import type { MethodEntityId, MethodModelMetadata, MethodModelReference } from "../shared";
import type { BayesianNetworkEvidenceConfiguration } from "../bayesian-network";
import type { HclEventBinding } from "./hcl-bindings";

interface HclBayesianNetworkReference {
  bayesianNetwork: MethodModelReference;
}

interface HclFaultTreeReference {
  faultTree: MethodModelReference;
}

type HclBaseEvidence = BayesianNetworkEvidenceConfiguration;

interface HclSolverSettings {
  variableOrder: MethodEntityId[] | null;
  foldConstants: boolean;
  spliceNullGates: boolean;
}

interface HclConfigurationModel extends Omit<MethodModelMetadata, "methodType">, HclBayesianNetworkReference {
  methodType: "HYBRID_CAUSAL_LOGIC";
  faultTrees: HclFaultTreeReference[];
  bindings: HclEventBinding[];
  baseEvidence: HclBaseEvidence;
  solverSettings: HclSolverSettings;
}

export type {
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclSolverSettings,
  HclConfigurationModel,
};
