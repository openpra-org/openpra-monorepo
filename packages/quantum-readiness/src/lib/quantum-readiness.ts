import type {
  AnalyzeFaultTreeReadinessOptions,
  NormalizedFaultTree,
  NormalizedFaultTreeNode,
  NormalizedGateType,
  QuantumReadinessCandidate,
  QuantumReadinessEvidenceTier,
  QuantumReadinessHardwareCompatibilityRow,
  QuantumReadinessHardwarePlatformId,
  QuantumReadinessReport,
  QuantumReadinessRequirementsAssessment,
  QuantumReadinessRequirementsMatrixEntry,
  QuantumReadinessSummary,
  QuantumReadinessThresholdStatus,
  QuantumReadinessTopologyClass,
  QuantumReadinessTopologyClassification,
} from "./types";

const MODULE_VERSION = "0.0.1";
const DEFAULT_MAX_BASIC_EVENTS = 8;
const DEFAULT_SUPPORTED_GATE_TYPES: NormalizedGateType[] = ["and", "or"];
const TOPOLOGY_CLASSIFICATION_RULE_VERSION = "phase3-bounded-v1";

interface TraversalResult {
  subtreeNodeIds: Set<string>;
  basicEventIds: Set<string>;
  gateNodeIds: Set<string>;
  supportedGateTypesFound: Set<NormalizedGateType>;
  unsupportedGateTypesFound: Set<NormalizedGateType>;
  issues: string[];
  maxDepth: number;
}

interface PublicHardwarePlatformDescriptor {
  platformId: QuantumReadinessHardwarePlatformId;
  platformLabel: string;
  publishedQubitCount: number;
}

const PUBLIC_HARDWARE_PLATFORM_SCREEN: PublicHardwarePlatformDescriptor[] = [
  {
    platformId: "googleWillow105",
    platformLabel: "Google Willow",
    publishedQubitCount: 105,
  },
  {
    platformId: "ibmHeronR2_156",
    platformLabel: "IBM Heron r2",
    publishedQubitCount: 156,
  },
  {
    platformId: "ionqForteEnterprise36",
    platformLabel: "IonQ Forte Enterprise",
    publishedQubitCount: 36,
  },
  {
    platformId: "quantinuumH2_56",
    platformLabel: "Quantinuum H2",
    publishedQubitCount: 56,
  },
];

const PHASE_C_REQUIREMENTS_MATRIX: QuantumReadinessRequirementsMatrixEntry[] = [
  buildRequirementsMatrixEntry("A", 5, 305, 514, "favorable", "projected"),
  buildRequirementsMatrixEntry("A", 6, 388, 634, "favorable", "measured"),
  buildRequirementsMatrixEntry("A", 8, 385, 711, "favorable", "measured"),
  buildRequirementsMatrixEntry("A", 10, 509, 819, "favorable", "measured"),
  buildRequirementsMatrixEntry("A", 12, 517, 875, "favorable", "measured"),
  buildRequirementsMatrixEntry("A", 15, 597, 1090, "favorable", "projected"),
  buildRequirementsMatrixEntry("A", 20, 872, 1305, "favorable", "measured"),

  buildRequirementsMatrixEntry("B", 5, 235, 398, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 6, 298, 488, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 8, 545, 735, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 10, 577, 837, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 12, 711, 1046, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 15, 741, 1015, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("B", 20, 1094, 1620, "unfavorable", "measured"),

  buildRequirementsMatrixEntry("C", 5, 238, 406, "favorable", "projected"),
  buildRequirementsMatrixEntry("C", 6, 286, 476, "favorable", "measured"),
  buildRequirementsMatrixEntry("C", 8, 358, 648, "favorable", "measured"),
  buildRequirementsMatrixEntry("C", 10, 430, 820, "favorable", "projected"),
  buildRequirementsMatrixEntry("C", 12, 502, 992, "favorable", "projected"),
  buildRequirementsMatrixEntry("C", 15, 610, 1250, "favorable", "projected"),
  buildRequirementsMatrixEntry("C", 20, 790, 1680, "favorable", "projected"),

  buildRequirementsMatrixEntry("D", 5, 316, 489, "unfavorable", "projected"),
  buildRequirementsMatrixEntry("D", 6, 390, 619, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("D", 8, 410, 785, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("D", 10, 456, 783, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("D", 12, 566, 849, "unfavorable", "measured"),
  buildRequirementsMatrixEntry("D", 15, 678, 1149, "unfavorable", "projected"),
  buildRequirementsMatrixEntry("D", 20, 729, 1217, "unfavorable", "measured"),
];

/**
 * Extract candidate subtree rows from a normalized fault tree.
 *
 * Version 1 treats each gate node as a candidate root by default.
 */
export function extractCandidateSubtrees(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {},
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
  options: AnalyzeFaultTreeReadinessOptions = {},
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
      .map((candidate) => candidate.rootNodeId),
    ...(normalizedOptions.includeTopologyClassification ?
      { topologyClassCounts: countTopologyClasses(candidates) }
    : {}),
    ...(normalizedOptions.includeRequirementsMatrix ?
      {
        requirementsMatrixMatchedCandidateIds: candidates
          .filter((candidate) => candidate.requirementsAssessment?.matrixEntryMatched)
          .map((candidate) => candidate.rootNodeId),
        recommendedExecutionPriorityCandidateIds: candidates
          .filter((candidate) => candidate.requirementsAssessment?.executionPriority === "high")
          .map((candidate) => candidate.rootNodeId),
      }
    : {}),
  };

  return {
    generatedAt: new Date().toISOString(),
    moduleVersion: MODULE_VERSION,
    summary,
    candidates,
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
    `Configured Supported Gate Types: ${report.summary.configuredSupportedGateTypes.length > 0 ? report.summary.configuredSupportedGateTypes.join(", ") : "none"}`,
  );

  if (report.summary.topologyClassCounts) {
    lines.push("Topology Class Counts:");
    lines.push(
      `A=${report.summary.topologyClassCounts.A}, B=${report.summary.topologyClassCounts.B}, C=${report.summary.topologyClassCounts.C}, D=${report.summary.topologyClassCounts.D}, unclassified=${report.summary.topologyClassCounts.unclassified}`,
    );
  }

  if (report.summary.requirementsMatrixMatchedCandidateIds) {
    lines.push(
      `Requirements Matrix Matched Candidate Ids: ${report.summary.requirementsMatrixMatchedCandidateIds.length > 0 ? report.summary.requirementsMatrixMatchedCandidateIds.join(", ") : "none"}`,
    );
  }

  if (report.summary.recommendedExecutionPriorityCandidateIds) {
    lines.push(
      `Recommended Execution Priority Candidate Ids: ${report.summary.recommendedExecutionPriorityCandidateIds.length > 0 ? report.summary.recommendedExecutionPriorityCandidateIds.join(", ") : "none"}`,
    );
  }

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

    if (candidate.topologyClassification) {
      lines.push(`Topology Class: ${candidate.topologyClassification.topologyClass}`);

      if (candidate.topologyClassification.reasons.length > 0) {
        lines.push(`Topology Notes: ${candidate.topologyClassification.reasons.join("; ")}`);
      }
    }

    if (candidate.requirementsAssessment) {
      lines.push(`Required Qubits: ${candidate.requirementsAssessment.requiredQubits}`);
      lines.push(`Preferred Depth: p = ${candidate.requirementsAssessment.preferredDepthP}`);
      lines.push(`Preferred Algorithm: ${candidate.requirementsAssessment.preferredAlgorithm}`);
      lines.push(`Avoid RL1: ${candidate.requirementsAssessment.avoidRL1 ? "yes" : "no"}`);
      lines.push(`Execution Priority: ${candidate.requirementsAssessment.executionPriority}`);

      if (candidate.requirementsAssessment.matrixEntry) {
        const entry = candidate.requirementsAssessment.matrixEntry;
        lines.push(
          `Requirements Matrix: class ${entry.topologyClass}, n=${entry.nBasic}, qubits=${entry.requiredQubits}, depth p=1=${entry.estimatedDepthP1}, depth p=2=${entry.estimatedDepthP2}, threshold=${entry.thresholdStatus}, tier=${entry.evidenceTier}`,
        );
      } else {
        lines.push("Requirements Matrix: no frozen Phase C row matched.");
      }

      lines.push(
        `Hardware Compatibility: ${candidate.requirementsAssessment.hardwareCompatibility
          .map((row) => `${row.platformLabel}=${row.qubitFit ? "fit" : "no-fit"}`)
          .join(", ")}`,
      );

      if (candidate.requirementsAssessment.guidanceNotes.length > 0) {
        lines.push(`Requirements Notes: ${candidate.requirementsAssessment.guidanceNotes.join("; ")}`);
      }
    }

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
  const includeRequirementsMatrix = options.includeRequirementsMatrix ?? false;

  return {
    maxBasicEvents: options.maxBasicEvents ?? DEFAULT_MAX_BASIC_EVENTS,
    supportedGateTypes: [...(options.supportedGateTypes ?? DEFAULT_SUPPORTED_GATE_TYPES)],
    includeBasicEventRoots: options.includeBasicEventRoots ?? false,
    includeTopologyClassification: (options.includeTopologyClassification ?? false) || includeRequirementsMatrix,
    includeRequirementsMatrix,
  };
}

function shouldTreatAsCandidateRoot(node: NormalizedFaultTreeNode, includeBasicEventRoots: boolean): boolean {
  if (node.kind === "gate") {
    return true;
  }

  return includeBasicEventRoots;
}

function buildCandidate(
  faultTree: NormalizedFaultTree,
  rootNode: NormalizedFaultTreeNode,
  options: Required<AnalyzeFaultTreeReadinessOptions>,
): QuantumReadinessCandidate {
  const traversal = traverseSubtree(faultTree, rootNode.id, options.supportedGateTypes);

  const exclusionReasons: string[] = [];

  if (traversal.basicEventIds.size === 0) {
    exclusionReasons.push("No reachable basic events were found.");
  }

  if (traversal.basicEventIds.size > options.maxBasicEvents) {
    exclusionReasons.push(
      `Basic event count ${traversal.basicEventIds.size} exceeds configured limit ${options.maxBasicEvents}.`,
    );
  }

  if (traversal.unsupportedGateTypesFound.size > 0) {
    const unsupportedGateTypes = [...traversal.unsupportedGateTypesFound].sort().join(", ");
    const supportedGateTypes = [...options.supportedGateTypes].sort().join(", ");

    exclusionReasons.push(
      `Unsupported gate types present: ${unsupportedGateTypes}. In this OpenPRA quantum readiness version, only ${supportedGateTypes} gate types are treated as quantum tractable candidates.`,
    );
  }

  if (traversal.issues.length > 0) {
    exclusionReasons.push(
      "Traversal issues were detected. Review the candidate subtree structure for missing nodes, cycles, missing gate types, or empty gate children.",
    );
  }

  const topologyClassification =
    options.includeTopologyClassification ?
      classifyCandidateTopology(faultTree, rootNode, traversal, exclusionReasons)
    : undefined;

  const requirementsAssessment =
    options.includeRequirementsMatrix ?
      buildRequirementsAssessment(traversal.basicEventIds.size, topologyClassification?.topologyClass)
    : undefined;

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
    issues: traversal.issues,
    ...(topologyClassification ? { topologyClassification } : {}),
    ...(requirementsAssessment ? { requirementsAssessment } : {}),
  };
}

function traverseSubtree(
  faultTree: NormalizedFaultTree,
  rootNodeId: string,
  supportedGateTypes: NormalizedGateType[],
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
    maxDepth,
  };
}

function classifyCandidateTopology(
  faultTree: NormalizedFaultTree,
  rootNode: NormalizedFaultTreeNode,
  traversal: TraversalResult,
  exclusionReasons: string[],
): QuantumReadinessTopologyClassification {
  const rootChildNodeIds = rootNode.kind === "gate" ? uniqueSortedStrings([...(rootNode.children ?? [])]) : [];

  let rootChildBasicEventCount = 0;
  let rootChildAndGateCount = 0;
  let rootChildOrGateCount = 0;
  let rootChildOtherGateCount = 0;

  const reasons: string[] = [];

  if (exclusionReasons.length > 0) {
    reasons.push("Candidate is not quantum tractable under the current first-pass screen.");
  }

  if (rootNode.kind !== "gate") {
    reasons.push("Candidate root is not a gate.");
    return buildTopologyClassification("unclassified", reasons, {
      rootChildNodeIds,
      rootChildBasicEventCount,
      rootChildAndGateCount,
      rootChildOrGateCount,
      rootChildOtherGateCount,
    });
  }

  if (rootNode.gateType !== "or") {
    reasons.push(
      `Bounded topology classification currently requires an OR root. Found ${rootNode.gateType ?? "unknown"}.`,
    );
  }

  for (const childId of rootChildNodeIds) {
    const childNode = faultTree.nodes[childId];

    if (!childNode) {
      rootChildOtherGateCount += 1;
      reasons.push(`Root child ${childId} is missing from the normalized fault tree.`);
      continue;
    }

    if (childNode.kind === "basicEvent") {
      rootChildBasicEventCount += 1;
      continue;
    }

    if (childNode.gateType === "and") {
      rootChildAndGateCount += 1;
      continue;
    }

    if (childNode.gateType === "or") {
      rootChildOrGateCount += 1;
      continue;
    }

    rootChildOtherGateCount += 1;
    reasons.push(
      `Root child ${childId} has gate type ${childNode.gateType ?? "unknown"}, which is outside the bounded topology rules.`,
    );
  }

  const basicEventCount = traversal.basicEventIds.size;
  const rootChildCount = rootChildNodeIds.length;

  if (
    reasons.length === 0 &&
    basicEventCount === 5 &&
    rootChildBasicEventCount > 0 &&
    rootChildAndGateCount > 0 &&
    rootChildOrGateCount === 0 &&
    rootChildOtherGateCount === 0
  ) {
    return buildTopologyClassification(
      "A",
      ["Matched bounded topology rule A: OR root with mixed direct basic-event and AND-gate children at n=5."],
      {
        rootChildNodeIds,
        rootChildBasicEventCount,
        rootChildAndGateCount,
        rootChildOrGateCount,
        rootChildOtherGateCount,
      },
    );
  }

  if (
    reasons.length === 0 &&
    basicEventCount === 6 &&
    rootChildBasicEventCount === 0 &&
    rootChildAndGateCount === rootChildCount &&
    rootChildCount > 0 &&
    rootChildOrGateCount === 0 &&
    rootChildOtherGateCount === 0
  ) {
    return buildTopologyClassification(
      "B",
      ["Matched bounded topology rule B: OR root with only AND-gate children at n=6."],
      {
        rootChildNodeIds,
        rootChildBasicEventCount,
        rootChildAndGateCount,
        rootChildOrGateCount,
        rootChildOtherGateCount,
      },
    );
  }

  if (
    reasons.length === 0 &&
    basicEventCount === 8 &&
    rootChildBasicEventCount === 0 &&
    rootChildAndGateCount === rootChildCount &&
    rootChildCount > 0 &&
    rootChildOrGateCount === 0 &&
    rootChildOtherGateCount === 0
  ) {
    return buildTopologyClassification(
      "C",
      ["Matched bounded topology rule C: OR root with only AND-gate children at n=8."],
      {
        rootChildNodeIds,
        rootChildBasicEventCount,
        rootChildAndGateCount,
        rootChildOrGateCount,
        rootChildOtherGateCount,
      },
    );
  }

  if (
    reasons.length === 0 &&
    basicEventCount === 8 &&
    rootChildBasicEventCount === 0 &&
    rootChildAndGateCount > 0 &&
    rootChildOrGateCount > 0 &&
    rootChildOtherGateCount === 0
  ) {
    return buildTopologyClassification(
      "D",
      ["Matched bounded topology rule D: OR root with mixed AND-gate and OR-gate children at n=8."],
      {
        rootChildNodeIds,
        rootChildBasicEventCount,
        rootChildAndGateCount,
        rootChildOrGateCount,
        rootChildOtherGateCount,
      },
    );
  }

  reasons.push("No bounded topology classification rule matched this candidate.");

  return buildTopologyClassification("unclassified", reasons, {
    rootChildNodeIds,
    rootChildBasicEventCount,
    rootChildAndGateCount,
    rootChildOrGateCount,
    rootChildOtherGateCount,
  });
}

function buildRequirementsAssessment(
  requiredQubits: number,
  topologyClass: QuantumReadinessTopologyClass | undefined,
): QuantumReadinessRequirementsAssessment {
  const hardwareCompatibility = PUBLIC_HARDWARE_PLATFORM_SCREEN.map((platform) =>
    buildHardwareCompatibilityRow(platform, requiredQubits),
  );

  const matrixEntry =
    topologyClass && topologyClass !== "unclassified" ?
      lookupRequirementsMatrixEntry(topologyClass, requiredQubits)
    : undefined;

  const guidanceNotes: string[] = [
    "Default bounded roadmap guidance is depth p = 1.",
    "Avoid RL1 under the current empirical guidance.",
    "Use QAOA+ rather than alternative circuit families under the current empirical guidance.",
    "Public hardware compatibility is a qubit-count-only screen and does not guarantee execution feasibility.",
  ];

  if (!matrixEntry) {
    if (!topologyClass || topologyClass === "unclassified") {
      guidanceNotes.push(
        "Requirements matrix lookup is unavailable because the candidate is currently unclassified under the bounded topology rules.",
      );
    } else {
      guidanceNotes.push(
        `No frozen Phase C requirements matrix row matched topology class ${topologyClass} at n = ${requiredQubits}.`,
      );
    }

    return {
      requiredQubits,
      matrixEntryMatched: false,
      hardwareCompatibility,
      preferredDepthP: 1,
      avoidRL1: true,
      preferredAlgorithm: "QAOA+",
      executionPriority: "unknown",
      guidanceNotes: uniqueSortedStrings(guidanceNotes),
    };
  }

  if (
    (matrixEntry.topologyClass === "A" || matrixEntry.topologyClass === "C") &&
    matrixEntry.thresholdStatus === "favorable"
  ) {
    guidanceNotes.push("Prioritize threshold-favorable Class A or Class C candidates at smaller target sizes first.");
  } else {
    guidanceNotes.push("Defer threshold-unfavorable candidates relative to favorable Class A and Class C candidates.");
  }

  return {
    requiredQubits,
    matrixEntryMatched: true,
    matrixEntry,
    hardwareCompatibility,
    preferredDepthP: 1,
    avoidRL1: true,
    preferredAlgorithm: "QAOA+",
    executionPriority:
      (
        (matrixEntry.topologyClass === "A" || matrixEntry.topologyClass === "C") &&
        matrixEntry.thresholdStatus === "favorable"
      ) ?
        "high"
      : "low",
    guidanceNotes: uniqueSortedStrings(guidanceNotes),
  };
}

function buildHardwareCompatibilityRow(
  platform: PublicHardwarePlatformDescriptor,
  requiredQubits: number,
): QuantumReadinessHardwareCompatibilityRow {
  return {
    platformId: platform.platformId,
    platformLabel: platform.platformLabel,
    publishedQubitCount: platform.publishedQubitCount,
    qubitFit: requiredQubits <= platform.publishedQubitCount,
    caveat: "Qubit-count fit does not guarantee execution feasibility, compilation success, or deployment readiness.",
  };
}

function lookupRequirementsMatrixEntry(
  topologyClass: Exclude<QuantumReadinessTopologyClass, "unclassified">,
  nBasic: number,
): QuantumReadinessRequirementsMatrixEntry | undefined {
  return PHASE_C_REQUIREMENTS_MATRIX.find((entry) => entry.topologyClass === topologyClass && entry.nBasic === nBasic);
}

function buildRequirementsMatrixEntry(
  topologyClass: Exclude<QuantumReadinessTopologyClass, "unclassified">,
  nBasic: number,
  estimatedDepthP1: number,
  estimatedDepthP2: number,
  thresholdStatus: QuantumReadinessThresholdStatus,
  evidenceTier: QuantumReadinessEvidenceTier,
): QuantumReadinessRequirementsMatrixEntry {
  return {
    topologyClass,
    nBasic,
    requiredQubits: nBasic,
    estimatedDepthP1,
    estimatedDepthP2,
    thresholdStatus,
    evidenceTier,
  };
}

function buildTopologyClassification(
  topologyClass: QuantumReadinessTopologyClass,
  reasons: string[],
  counts: {
    rootChildNodeIds: string[];
    rootChildBasicEventCount: number;
    rootChildAndGateCount: number;
    rootChildOrGateCount: number;
    rootChildOtherGateCount: number;
  },
): QuantumReadinessTopologyClassification {
  return {
    topologyClass,
    classificationRuleVersion: TOPOLOGY_CLASSIFICATION_RULE_VERSION,
    reasons: uniqueSortedStrings(reasons),
    rootChildNodeIds: [...counts.rootChildNodeIds].sort(),
    rootChildBasicEventCount: counts.rootChildBasicEventCount,
    rootChildAndGateCount: counts.rootChildAndGateCount,
    rootChildOrGateCount: counts.rootChildOrGateCount,
    rootChildOtherGateCount: counts.rootChildOtherGateCount,
  };
}

function countTopologyClasses(candidates: QuantumReadinessCandidate[]): Record<QuantumReadinessTopologyClass, number> {
  const counts: Record<QuantumReadinessTopologyClass, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    unclassified: 0,
  };

  for (const candidate of candidates) {
    const topologyClass = candidate.topologyClassification?.topologyClass ?? "unclassified";
    counts[topologyClass] += 1;
  }

  return counts;
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
