/**
 * Gate types supported by the normalized readiness analysis layer.
 */
export type NormalizedGateType = "and" | "or" | "not" | "xor" | "atleast" | "nand" | "nor";

/**
 * A normalized fault tree node used by the readiness analyzer.
 *
 * The readiness package works on this neutral structure so that later adapters
 * can convert from OpenPSA XML, MEF technical elements, database records, or
 * graph models without changing the core analysis logic.
 */
export interface NormalizedFaultTreeNode {
  /**
   * Stable node identifier.
   */
  id: string;

  /**
   * Human readable label if available.
   */
  label?: string;

  /**
   * Node kind.
   */
  kind: "gate" | "basicEvent";

  /**
   * Gate type for gate nodes.
   */
  gateType?: NormalizedGateType;

  /**
   * Child node identifiers for gate nodes.
   */
  children?: string[];

  /**
   * Optional extra metadata preserved by adapters.
   */
  metadata?: Record<string, unknown>;
}

/**
 * A normalized fault tree input model.
 */
export interface NormalizedFaultTree {
  /**
   * Stable model identifier.
   */
  id: string;

  /**
   * Human readable model name.
   */
  name: string;

  /**
   * Root or top event node identifier.
   */
  topNodeId: string;

  /**
   * Source format label carried forward by adapters.
   */
  sourceFormat?: "normalized" | "openpsa" | "mef" | "unknown";

  /**
   * All nodes keyed by identifier.
   */
  nodes: Record<string, NormalizedFaultTreeNode>;
}

/**
 * Options controlling the first-pass readiness screen.
 */
export interface AnalyzeFaultTreeReadinessOptions {
  /**
   * Maximum basic-event count allowed for a candidate to be marked tractable.
   *
   * Default: 8
   */
  maxBasicEvents?: number;

  /**
   * Gate types treated as supported by the current screen.
   *
   * Default: ["and", "or"]
   */
  supportedGateTypes?: NormalizedGateType[];

  /**
   * When true, basic event nodes are also treated as candidate roots.
   *
   * Default: false
   */
  includeBasicEventRoots?: boolean;
}

/**
 * A single candidate subtree report row.
 */
export interface QuantumReadinessCandidate {
  /**
   * Candidate root node identifier.
   */
  rootNodeId: string;

  /**
   * Candidate root node label if available.
   */
  rootNodeLabel?: string;

  /**
   * Candidate root kind.
   */
  rootNodeKind: "gate" | "basicEvent";

  /**
   * Gate type at the root when the candidate root is a gate.
   */
  rootGateType?: NormalizedGateType;

  /**
   * All nodes reachable from the candidate root.
   */
  subtreeNodeIds: string[];

  /**
   * Reachable basic event identifiers.
   */
  basicEventIds: string[];

  /**
   * Reachable gate node identifiers.
   */
  gateNodeIds: string[];

  /**
   * Number of reachable basic events.
   */
  basicEventCount: number;

  /**
   * Number of reachable gate nodes.
   */
  gateCount: number;

  /**
   * Maximum depth from the root to a reachable descendant.
   */
  maxDepth: number;

  /**
   * Supported gate types found in the subtree.
   */
  supportedGateTypesFound: NormalizedGateType[];

  /**
   * Unsupported gate types found in the subtree.
   */
  unsupportedGateTypesFound: NormalizedGateType[];

  /**
   * Whether the candidate passes the current first-pass screen.
   */
  quantumTractable: boolean;

  /**
   * Why the candidate failed the screen if it did.
   */
  exclusionReasons: string[];

  /**
   * Additional structural issues found while traversing.
   */
  issues: string[];
}

/**
 * Top level aggregate summary.
 */
export interface QuantumReadinessSummary {
  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalNodes: number;
  totalGateNodes: number;
  totalBasicEventNodes: number;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  configuredMaxBasicEvents: number;
  configuredSupportedGateTypes: NormalizedGateType[];
  tractableCandidateIds: string[];
}

/**
 * Final deterministic readiness report.
 */
export interface QuantumReadinessReport {
  generatedAt: string;
  moduleVersion: string;
  summary: QuantumReadinessSummary;
  candidates: QuantumReadinessCandidate[];
}
