import type {
  AnalyzeFaultTreeReadinessOptions,
  NormalizedFaultTree,
  NormalizedFaultTreeNode,
  NormalizedGateType,
  QuantumReadinessCandidate,
  QuantumReadinessReport,
  QuantumReadinessSummary
} from "./types";

const MODULE_VERSION = "0.0.1";
const DEFAULT_MAX_BASIC_EVENTS = 8;
const DEFAULT_SUPPORTED_GATE_TYPES: NormalizedGateType[] = ["and", "or"];

interface TraversalResult {
  subtreeNodeIds: Set<string>;
  basicEventIds: Set<string>;
  gateNodeIds: Set<string>;
  supportedGateTypesFound: Set<NormalizedGateType>;
  unsupportedGateTypesFound: Set<NormalizedGateType>;
  issues: string[];
  maxDepth: number;
}

/**
 * Extract candidate subtree rows from a normalized fault tree.
 *
 * Version 1 treats each gate node as a candidate root by default.
 */
export function extractCandidateSubtrees(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {}
): QuantumReadinessCandidate[] {
  const normalizedOptions = normalizeOptions(options);

  const candidates = Object.values(faultTree.nodes)
    .filter((node) => shouldTreatAsCandidateRoot(node, normalizedOptions.includeBasicEventRoots))
    .map((node) => buildCandidate(faultTree, node, normalizedOptions))
    .sort((left, right) => left.rootNodeId.localeCompare(right.rootNodeId));

  return candidates;
}

/**
 * Analyze a normalized fault tree and return a deterministic readiness report.
 */
export function analyzeFaultTreeReadiness(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {}
): QuantumReadinessReport {
  const normalizedOptions = normalizeOptions(options);
  const candidates = extractCandidateSubtrees(faultTree, normalizedOptions);

  const summary: QuantumReadinessSummary = {
    modelId: faultTree.id,
    modelName: faultTree.name,
    sourceFormat: faultTree.sourceFormat ?? "unknown",
    totalNodes: Object.keys(faultTree.nodes).length,
    totalGateNodes: Object.values(faultTree.nodes).filter((node) => node.kind === "gate").length,
    totalBasicEventNodes: Object.values(faultTree.nodes).filter((node) => node.kind === "basicEvent").length,
    totalCandidateSubtrees: candidates.length,
    totalQuantumTractableCandidates: candidates.filter((candidate) => candidate.quantumTractable).length,
    configuredMaxBasicEvents: normalizedOptions.maxBasicEvents,
    configuredSupportedGateTypes: [...normalizedOptions.supportedGateTypes],
    tractableCandidateIds: candidates
      .filter((candidate) => candidate.quantumTractable)
      .map((candidate) => candidate.rootNodeId)
  };

  return {
    generatedAt: new Date().toISOString(),
    moduleVersion: MODULE_VERSION,
    summary,
    candidates
  };
}

/**
 * Build a human readable markdown summary from a readiness report.
 */
export function buildReadinessSummary(report: QuantumReadinessReport): string {
  const lines: string[] = [];

  lines.push("# Quantum Readiness Summary");
  lines.push("");
  lines.push(`Model ID: ${report.summary.modelId}`);
  lines.push(`Model Name: ${report.summary.modelName}`);
  lines.push(`Source Format: ${report.summary.sourceFormat}`);
  lines.push(`Generated At: ${report.generatedAt}`);
  lines.push(`Module Version: ${report.moduleVersion}`);
  lines.push("");
  lines.push("## Aggregate Counts");
  lines.push("");
  lines.push(`Total Nodes: ${report.summary.totalNodes}`);
  lines.push(`Total Gate Nodes: ${report.summary.totalGateNodes}`);
  lines.push(`Total Basic Event Nodes: ${report.summary.totalBasicEventNodes}`);
  lines.push(`Total Candidate Subtrees: ${report.summary.totalCandidateSubtrees}`);
  lines.push(`Quantum Tractable Candidates: ${report.summary.totalQuantumTractableCandidates}`);
  lines.push(`Configured Max Basic Events: ${report.summary.configuredMaxBasicEvents}`);
  lines.push(
    `Configured Supported Gate Types: ${report.summary.configuredSupportedGateTypes.length > 0 ? report.summary.configuredSupportedGateTypes.join(", ") : "none"}`
  );
  lines.push("");
  lines.push("## Candidate Overview");
  lines.push("");

  if (report.candidates.length === 0) {
    lines.push("No candidates were identified.");
    return lines.join("\n");
  }

  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.rootNodeId}`);
    lines.push(`Root Kind: ${candidate.rootNodeKind}`);
    lines.push(`Root Gate Type: ${candidate.rootGateType ?? "n/a"}`);
    lines.push(`Basic Event Count: ${candidate.basicEventCount}`);
    lines.push(`Gate Count: ${candidate.gateCount}`);
    lines.push(`Max Depth: ${candidate.maxDepth}`);
    lines.push(`Quantum Tractable: ${candidate.quantumTractable ? "yes" : "no"}`);

    if (candidate.exclusionReasons.length > 0) {
      lines.push(`Exclusion Reasons: ${candidate.exclusionReasons.join("; ")}`);
    }

    if (candidate.issues.length > 0) {
      lines.push(`Issues: ${candidate.issues.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function normalizeOptions(options: AnalyzeFaultTreeReadinessOptions): Required<AnalyzeFaultTreeReadinessOptions> {
  return {
    maxBasicEvents: options.maxBasicEvents ?? DEFAULT_MAX_BASIC_EVENTS,
    supportedGateTypes: [...(options.supportedGateTypes ?? DEFAULT_SUPPORTED_GATE_TYPES)],
    includeBasicEventRoots: options.includeBasicEventRoots ?? false
  };
}

function shouldTreatAsCandidateRoot(
  node: NormalizedFaultTreeNode,
  includeBasicEventRoots: boolean
): boolean {
  if (node.kind === "gate") {
    return true;
  }

  return includeBasicEventRoots;
}

function buildCandidate(
  faultTree: NormalizedFaultTree,
  rootNode: NormalizedFaultTreeNode,
  options: Required<AnalyzeFaultTreeReadinessOptions>
): QuantumReadinessCandidate {
  const traversal = traverseSubtree(faultTree, rootNode.id, options.supportedGateTypes);

  const exclusionReasons: string[] = [];

  if (traversal.basicEventIds.size === 0) {
    exclusionReasons.push("No reachable basic events were found.");
  }

  if (traversal.basicEventIds.size > options.maxBasicEvents) {
    exclusionReasons.push(
      `Basic event count ${traversal.basicEventIds.size} exceeds configured limit ${options.maxBasicEvents}.`
    );
  }

  if (traversal.unsupportedGateTypesFound.size > 0) {
    exclusionReasons.push(
      `Unsupported gate types present: ${[...traversal.unsupportedGateTypesFound].sort().join(", ")}.`
    );
  }

  if (traversal.issues.length > 0) {
    exclusionReasons.push("Traversal issues were detected.");
  }

  return {
    rootNodeId: rootNode.id,
    rootNodeLabel: rootNode.label,
    rootNodeKind: rootNode.kind,
    rootGateType: rootNode.gateType,
    subtreeNodeIds: [...traversal.subtreeNodeIds].sort(),
    basicEventIds: [...traversal.basicEventIds].sort(),
    gateNodeIds: [...traversal.gateNodeIds].sort(),
    basicEventCount: traversal.basicEventIds.size,
    gateCount: traversal.gateNodeIds.size,
    maxDepth: traversal.maxDepth,
    supportedGateTypesFound: [...traversal.supportedGateTypesFound].sort(),
    unsupportedGateTypesFound: [...traversal.unsupportedGateTypesFound].sort(),
    quantumTractable: exclusionReasons.length === 0,
    exclusionReasons,
    issues: traversal.issues
  };
}

function traverseSubtree(
  faultTree: NormalizedFaultTree,
  rootNodeId: string,
  supportedGateTypes: NormalizedGateType[]
): TraversalResult {
  const subtreeNodeIds = new Set<string>();
  const basicEventIds = new Set<string>();
  const gateNodeIds = new Set<string>();
  const supportedGateTypesFound = new Set<NormalizedGateType>();
  const unsupportedGateTypesFound = new Set<NormalizedGateType>();
  const issues: string[] = [];
  const supportedGateTypeSet = new Set<NormalizedGateType>(supportedGateTypes);

  let maxDepth = 0;

  const visit = (nodeId: string, depth: number, activePath: Set<string>): void => {
    if (activePath.has(nodeId)) {
      issues.push(`Cycle detected at node ${nodeId}.`);
      return;
    }

    const node = faultTree.nodes[nodeId];
    if (!node) {
      issues.push(`Missing node reference: ${nodeId}.`);
      return;
    }

    subtreeNodeIds.add(nodeId);
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    if (node.kind === "basicEvent") {
      basicEventIds.add(nodeId);
      return;
    }

    gateNodeIds.add(nodeId);

    if (!node.gateType) {
      issues.push(`Gate node ${nodeId} is missing gateType.`);
    } else if (supportedGateTypeSet.has(node.gateType)) {
      supportedGateTypesFound.add(node.gateType);
    } else {
      unsupportedGateTypesFound.add(node.gateType);
    }

    const children = node.children ?? [];
    if (children.length === 0) {
      issues.push(`Gate node ${nodeId} has no children.`);
    }

    const nextPath = new Set(activePath);
    nextPath.add(nodeId);

    for (const childId of children) {
      visit(childId, depth + 1, nextPath);
    }
  };

  visit(rootNodeId, 0, new Set<string>());

  return {
    subtreeNodeIds,
    basicEventIds,
    gateNodeIds,
    supportedGateTypesFound,
    unsupportedGateTypesFound,
    issues: uniqueSortedStrings(issues),
    maxDepth
  };
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
