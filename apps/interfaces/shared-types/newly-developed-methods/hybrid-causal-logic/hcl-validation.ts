import {
  createAnalysisReadyValidationOutcome,
  createDraftValidationOutcome,
} from "../shared";
import type {
  AnalysisReadyValidationOutcome,
  DraftValidationOutcome,
  ValidationIssue,
} from "../shared";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkModel,
} from "../bayesian-network";
import {
  validateFaultTreeBooleanGraph,
  validateFaultTreeGateInputs,
  validateFaultTreeKOfN,
  validateFaultTreeReachability,
  validateFaultTreeTopGate,
  type FaultTreeModel,
} from "../fault-tree";
import type { HclConfigurationModel } from "./hcl-configuration";

interface HclValidationContext {
  bayesianNetworks?: BayesianNetworkModel[];
  faultTrees?: FaultTreeModel[];
}

const validateHclConfigurationModel = (
  model: HclConfigurationModel,
  context: HclValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const bayesianNetworks = context.bayesianNetworks ?? [];
  const faultTrees = context.faultTrees ?? [];
  const matchingBayesianNetworks = bayesianNetworks.filter(
    (candidate) => candidate.id === model.bayesianNetwork.modelId,
  );

  if (matchingBayesianNetworks.length !== 1) {
    issues.push({
      code:
        matchingBayesianNetworks.length === 0
          ? "HCL_BAYESIAN_NETWORK_NOT_FOUND"
          : "HCL_BAYESIAN_NETWORK_AMBIGUOUS",
      severity: "ERROR",
      message:
        matchingBayesianNetworks.length === 0
          ? "The HCL Bayesian-network reference does not resolve"
          : "The HCL Bayesian-network reference must resolve exactly once",
      entityId: model.id,
      fieldPath: ["bayesianNetwork", "modelId"],
    });
  } else {
    issues.push(
      ...validateBayesianNetworkModel(
        matchingBayesianNetworks[0],
        { hclBindings: model.bindings },
      ),
    );
  }

  if (model.faultTrees.length === 0) {
    issues.push({
      code: "HCL_FAULT_TREE_REQUIRED",
      severity: "ERROR",
      message: "An HCL configuration must reference at least one fault tree",
      entityId: model.id,
      fieldPath: ["faultTrees"],
    });
  }

  const resolvedFaultTrees = new Map<string, FaultTreeModel>();
  model.faultTrees.forEach((reference, referenceIndex) => {
    const matches = faultTrees.filter(
      (candidate) => candidate.id === reference.faultTree.modelId,
    );
    if (matches.length === 1) {
      const faultTree = matches[0];
      resolvedFaultTrees.set(reference.faultTree.modelId, faultTree);
      issues.push(
        ...validateFaultTreeTopGate(faultTree),
        ...validateFaultTreeGateInputs(faultTree),
        ...validateFaultTreeKOfN(faultTree),
        ...validateFaultTreeBooleanGraph(faultTree),
        ...validateFaultTreeReachability(faultTree),
      );
      return;
    }
    issues.push({
      code:
        matches.length === 0
          ? "HCL_FAULT_TREE_NOT_FOUND"
          : "HCL_FAULT_TREE_AMBIGUOUS",
      severity: "ERROR",
      message:
        matches.length === 0
          ? "An HCL fault-tree reference does not resolve"
          : "An HCL fault-tree reference must resolve exactly once",
      entityId: reference.faultTree.modelId,
      fieldPath: ["faultTrees", referenceIndex, "faultTree", "modelId"],
    });
  });

  model.bindings.forEach((binding, bindingIndex) => {
    const faultTree = resolvedFaultTrees.get(binding.faultTreeBasicEvent.modelId);
    if (faultTree === undefined) return;
    const matches = faultTree.leafNodes.filter(
      (leaf) =>
        leaf.kind === "BASIC_EVENT_REFERENCE" &&
        leaf.basicEventId === binding.faultTreeBasicEvent.entityId,
    );
    if (matches.length === 1) return;
    issues.push({
      code:
        matches.length === 0
          ? "HCL_FAULT_TREE_BASIC_EVENT_NOT_FOUND"
          : "HCL_FAULT_TREE_BASIC_EVENT_AMBIGUOUS",
      severity: "ERROR",
      message:
        matches.length === 0
          ? "The bound basic event does not resolve in its fault tree"
          : "The bound basic event must resolve exactly once in its fault tree",
      entityId: binding.id,
      fieldPath: ["bindings", bindingIndex, "faultTreeBasicEvent"],
    });
  });

  return issues;
};

const validateHclDraft = (
  model: HclConfigurationModel,
  validatedAt: string,
  context: HclValidationContext = {},
): DraftValidationOutcome =>
  createDraftValidationOutcome({
    modelId: model.id,
    revision: model.revision,
    issues: validateHclConfigurationModel(model, context),
    validatedAt,
  });

const validateHclAnalysisReady = (
  model: HclConfigurationModel,
  validatedAt: string,
  context: HclValidationContext = {},
): AnalysisReadyValidationOutcome =>
  createAnalysisReadyValidationOutcome({
    modelId: model.id,
    revision: model.revision,
    issues: validateHclConfigurationModel(model, context),
    validatedAt,
  });

export {
  validateHclConfigurationModel,
  validateHclDraft,
  validateHclAnalysisReady,
};
export type { HclValidationContext };
