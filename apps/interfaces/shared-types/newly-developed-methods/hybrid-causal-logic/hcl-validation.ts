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
import { HclCptPriorSchema, HclCptGeneratorSchema } from "interfaces-mef-types/zod/modeling";

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
    const bn = matchingBayesianNetworks[0].model;
    const betaStates = new Map<string, string>();
    model.solverSettings.uncertainty?.cptRowDistributions.forEach((definition, index) => {
      const node = bn.nodes.find((candidate) => candidate.id === definition.bayesianNetworkNode.entityId);
      const table = bn.conditionalProbabilityTables.find((candidate) => candidate.nodeId === node?.id);
      const parsed = HclCptPriorSchema.safeParse(definition.prior);
      const prior = parsed.success ? parsed.data : undefined;
      const consistentBetaState = prior?.family !== "BETA" || !betaStates.has(node?.id ?? "") || betaStates.get(node?.id ?? "") === prior.trueStateId;
      if (node && prior?.family === "BETA") betaStates.set(node.id, prior.trueStateId);
      const valid = consistentBetaState && node && table?.rows.some((row) => row.id === definition.cptRowId) && prior && (
        prior.family === "BETA"
          ? node.states.length === 2 && node.states.some((state) => state.id === prior.trueStateId)
          : prior.alpha.length === node.states.length
      );
      if (!valid) issues.push({
        code: "HCL_CPT_PRIOR_INVALID", severity: "ERROR",
        message: "CPT uncertainty needs an existing row and an explicit prior matching its states. Beta needs two states and one consistent probability state per node; Dirichlet needs one alpha per state.",
        entityId: definition.bayesianNetworkNode.entityId,
        fieldPath: ["solverSettings", "uncertainty", "cptRowDistributions", index],
      });
    });
    const generatorNodes = new Set<string>();
    model.solverSettings.uncertainty?.cptGenerators?.forEach((definition, index) => {
      const node = bn.nodes.find((n) => n.id === definition.bayesianNetworkNode.entityId);
      const table = bn.conditionalProbabilityTables.find((t) => t.nodeId === node?.id);
      const parsed = HclCptGeneratorSchema.safeParse(definition.generator);
      let valid = parsed.success && !!node && !!table
        && definition.bayesianNetworkNode.workbookId === model.bayesianNetwork.workbookId
        && definition.bayesianNetworkNode.modelId === model.bayesianNetwork.modelId
        && !generatorNodes.has(definition.bayesianNetworkNode.entityId)
        && !model.solverSettings.uncertainty?.cptRowDistributions.some((r) => r.bayesianNetworkNode.entityId === definition.bayesianNetworkNode.entityId);
      generatorNodes.add(definition.bayesianNetworkNode.entityId);
      if (parsed.success && node && table) {
        const g = parsed.data;
        if (g.type === "seismic_fragility") {
          const parent = bn.nodes.find((n) => n.id === g.pgaParentId);
          valid &&= node.states.length === 2 && node.states.some((s) => s.id === g.trueStateId) && node.states.some((s) => s.id === g.falseStateId)
            && table.parents.some((p) => p.nodeId === g.pgaParentId) && !!parent
            && parent.states.length === g.pgaCenters.length && parent.states.every((s) => g.pgaCenters.some((c) => c.stateId === s.id));
        } else {
          valid &&= table.parents.length === 0 && node.states.some((s) => s.id === g.noneStateId)
            && g.bins.length + 1 === node.states.length && node.states.every((s) => s.id === g.noneStateId || g.bins.some((b) => b.stateId === s.id));
        }
      }
      if (!valid) issues.push({ code: "HCL_CPT_GENERATOR_INVALID", severity: "ERROR", entityId: definition.bayesianNetworkNode.entityId,
        message: "Seismic generator must match its BN node, parents and states, and cannot share a node with row priors or another generator.",
        fieldPath: ["solverSettings", "uncertainty", "cptGenerators", index] });
    });
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
