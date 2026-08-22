import {
  createAnalysisReadyValidationOutcome,
  createDraftValidationOutcome,
} from "../shared";
import type {
  AnalysisReadyValidationOutcome,
  DraftValidationOutcome,
  ValidationIssue,
  WorkbookId,
  WorkbookModelSnapshotIdentity,
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
  bayesianNetworks?: Array<{ workbookId: WorkbookId; model: BayesianNetworkModel }>;
  faultTrees?: Array<{ workbookId: WorkbookId; model: FaultTreeModel }>;
}

const validateHclConfigurationModel = (
  model: HclConfigurationModel,
  context: HclValidationContext = {},
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const bayesianNetworks = context.bayesianNetworks ?? [];
  const faultTrees = context.faultTrees ?? [];
  const matchingBayesianNetworks = bayesianNetworks.filter(
    (candidate) =>
      candidate.workbookId === model.bayesianNetwork.workbookId &&
      candidate.model.modelId === model.bayesianNetwork.modelId,
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
      entityId: model.modelId,
      fieldPath: ["bayesianNetwork", "modelId"],
    });
  } else {
    issues.push(
      ...validateBayesianNetworkModel(
        matchingBayesianNetworks[0].model,
        { hclBindings: model.bindings, workbookId: matchingBayesianNetworks[0].workbookId },
      ),
    );
  }

  if (model.faultTrees.length === 0) {
    issues.push({
      code: "HCL_FAULT_TREE_REQUIRED",
      severity: "ERROR",
      message: "An HCL configuration must reference at least one fault tree",
      entityId: model.modelId,
      fieldPath: ["faultTrees"],
    });
  }

  const resolvedFaultTrees: Array<{ workbookId: WorkbookId; model: FaultTreeModel }> = [];
  model.faultTrees.forEach((reference, referenceIndex) => {
    const matches = faultTrees.filter(
      (candidate) =>
        candidate.workbookId === reference.workbookId &&
        candidate.model.modelId === reference.modelId,
    );
    if (matches.length === 1) {
      const faultTree = matches[0].model;
      resolvedFaultTrees.push(matches[0]);
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
      entityId: reference.modelId,
      fieldPath: ["faultTrees", referenceIndex, "modelId"],
    });
  });

  model.bindings.forEach((binding, bindingIndex) => {
    const matches = resolvedFaultTrees.flatMap((resolved) =>
      resolved.workbookId === binding.faultTreeBasicEvent.workbookId
        ? resolved.model.leafNodes.filter(
            (leaf) =>
              leaf.kind === "BASIC_EVENT_REFERENCE" &&
              leaf.basicEventId === binding.faultTreeBasicEvent.entityId,
          )
        : [],
    );
    if (matches.length > 0) return;
    issues.push({
      code: "HCL_FAULT_TREE_BASIC_EVENT_NOT_FOUND",
      severity: "ERROR",
      message: "The bound basic event does not resolve in a declared fault tree",
      entityId: binding.id,
      fieldPath: ["bindings", bindingIndex, "faultTreeBasicEvent"],
    });
  });

  return issues;
};

const validateHclDraft = (
  model: HclConfigurationModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: HclValidationContext = {},
): DraftValidationOutcome =>
  createDraftValidationOutcome({
    owner,
    issues: validateHclConfigurationModel(model, context),
    validatedAt,
  });

const validateHclAnalysisReady = (
  model: HclConfigurationModel,
  owner: WorkbookModelSnapshotIdentity,
  validatedAt: string,
  context: HclValidationContext = {},
): AnalysisReadyValidationOutcome =>
  createAnalysisReadyValidationOutcome({
    owner,
    issues: validateHclConfigurationModel(model, context),
    validatedAt,
  });

export {
  validateHclConfigurationModel,
  validateHclDraft,
  validateHclAnalysisReady,
};
export type { HclValidationContext };
