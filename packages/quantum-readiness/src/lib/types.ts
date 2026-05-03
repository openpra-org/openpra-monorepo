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
 * Supported bounded topology classes for the Phase 3 readiness prototype.
 *
 * `unclassified` is deliberate. It lets the classifier stay honest when a
 * candidate falls outside the currently bounded Paper 13 aligned rules.
 */
export type QuantumReadinessTopologyClass = "A" | "B" | "C" | "D" | "unclassified";

/**
 * Deterministic topology classification details for a single candidate.
 */
export interface QuantumReadinessTopologyClassification {
  /**
   * Assigned bounded topology class.
   */
  topologyClass: QuantumReadinessTopologyClass;

  /**
   * Version label for the bounded classification rules.
   */
  classificationRuleVersion: string;

  /**
   * Human readable reasons describing either the matched rule or why the
   * candidate remained unclassified.
   */
  reasons: string[];

  /**
   * Stable ordered direct child ids of the candidate root.
   */
  rootChildNodeIds: string[];

  /**
   * Count of direct root children that are basic events.
   */
  rootChildBasicEventCount: number;

  /**
   * Count of direct root children that are AND gates.
   */
  rootChildAndGateCount: number;

  /**
   * Count of direct root children that are OR gates.
   */
  rootChildOrGateCount: number;

  /**
   * Count of direct root children that are other gate types or unresolved.
   */
  rootChildOtherGateCount: number;
}

/**
 * Threshold interpretation carried forward from the frozen Phase C matrix.
 */
export type QuantumReadinessThresholdStatus = "favorable" | "unfavorable";

/**
 * Evidence tier carried forward from the frozen Phase C matrix.
 */
export type QuantumReadinessEvidenceTier = "measured" | "projected";

/**
 * Public hardware capability screen platform identifiers.
 */
export type QuantumReadinessHardwarePlatformId =
  | "googleWillow105"
  | "ibmHeronR2_156"
  | "ionqForteEnterprise36"
  | "quantinuumH2_56";

/**
 * A single frozen Phase C requirements matrix row.
 */
export interface QuantumReadinessRequirementsMatrixEntry {
  topologyClass: Exclude<QuantumReadinessTopologyClass, "unclassified">;
  nBasic: number;
  requiredQubits: number;
  estimatedDepthP1: number;
  estimatedDepthP2: number;
  thresholdStatus: QuantumReadinessThresholdStatus;
  evidenceTier: QuantumReadinessEvidenceTier;
}

/**
 * One public hardware compatibility row.
 *
 * This is intentionally a qubit-count-only screen. It is not an execution
 * feasibility or deployment readiness claim.
 */
export interface QuantumReadinessHardwareCompatibilityRow {
  platformId: QuantumReadinessHardwarePlatformId;
  platformLabel: string;
  publishedQubitCount: number;
  qubitFit: boolean;
  caveat: string;
}

/**
 * Deterministic requirements lookup and public hardware screen result for a
 * single candidate.
 */
export interface QuantumReadinessRequirementsAssessment {
  requiredQubits: number;
  matrixEntryMatched: boolean;
  matrixEntry?: QuantumReadinessRequirementsMatrixEntry;
  hardwareCompatibility: QuantumReadinessHardwareCompatibilityRow[];
  preferredDepthP: 1;
  avoidRL1: true;
  preferredAlgorithm: "QAOA+";
  executionPriority: "high" | "low" | "unknown";
  guidanceNotes: string[];
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

  /**
   * When true, include bounded topology classification output in readiness
   * candidates and aggregate summary.
   *
   * Default: false
   */
  includeTopologyClassification?: boolean;

  /**
   * When true, include Phase C requirements matrix lookup and the public
   * qubit-count compatibility screen. This implicitly enables topology
   * classification because the matrix lookup depends on topology class.
   *
   * Default: false
   */
  includeRequirementsMatrix?: boolean;
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

  /**
   * Optional bounded topology classification details.
   */
  topologyClassification?: QuantumReadinessTopologyClassification;

  /**
   * Optional Phase C requirements and public hardware screen result.
   */
  requirementsAssessment?: QuantumReadinessRequirementsAssessment;
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

  /**
   * Optional aggregate counts by bounded topology class.
   */
  topologyClassCounts?: Record<QuantumReadinessTopologyClass, number>;

  /**
   * Optional list of candidate ids that matched a frozen Phase C matrix row.
   */
  requirementsMatrixMatchedCandidateIds?: string[];

  /**
   * Optional list of candidate ids that the bounded roadmap would prioritize.
   */
  recommendedExecutionPriorityCandidateIds?: string[];
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

/**
 * Deterministic downstream preparation payload for a single tractable candidate.
 */
export interface QuantumPreparationCandidatePayload {
  /**
   * Source model identifier.
   */
  modelId: string;

  /**
   * Source model name.
   */
  modelName: string;

  /**
   * Candidate root node identifier.
   */
  candidateRootNodeId: string;

  /**
   * Candidate root label if available.
   */
  candidateRootNodeLabel?: string;

  /**
   * Candidate root gate type if available.
   */
  candidateRootGateType?: NormalizedGateType;

  /**
   * Stable ordered basic event identifiers for downstream indexing.
   */
  orderedBasicEventIds: string[];

  /**
   * Stable ordered gate node identifiers in the candidate.
   */
  orderedGateNodeIds: string[];

  /**
   * Stable ordered subtree node identifiers in the candidate.
   */
  orderedSubtreeNodeIds: string[];

  /**
   * Supported gate types found in the candidate.
   */
  supportedGateTypesFound: NormalizedGateType[];

  /**
   * Maximum depth of the candidate subtree.
   */
  maxDepth: number;

  /**
   * Basic event count.
   */
  basicEventCount: number;

  /**
   * Gate count.
   */
  gateCount: number;

  /**
   * Optional bounded topology classification details.
   */
  topologyClassification?: QuantumReadinessTopologyClassification;

  /**
   * Optional Phase C requirements and public hardware screen result.
   */
  requirementsAssessment?: QuantumReadinessRequirementsAssessment;

  /**
   * Source format passed through from the normalized model.
   */
  sourceFormat: string;

  /**
   * Package module version used to create the payload.
   */
  moduleVersion: string;
}

/**
 * Deterministic export bundle for tractable preparation payloads.
 */
export interface QuantumPreparationExport {
  generatedAt: string;
  moduleVersion: string;
  modelId: string;
  modelName: string;
  sourceFormat: string;
  configuredMaxBasicEvents: number;
  configuredSupportedGateTypes: NormalizedGateType[];
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;

  /**
   * Optional aggregate counts by bounded topology class.
   */
  topologyClassCounts?: Record<QuantumReadinessTopologyClass, number>;

  /**
   * Optional list of candidate ids that matched a frozen Phase C matrix row.
   */
  requirementsMatrixMatchedCandidateIds?: string[];

  /**
   * Optional list of candidate ids that the bounded roadmap would prioritize.
   */
  recommendedExecutionPriorityCandidateIds?: string[];

  preparationCandidates: QuantumPreparationCandidatePayload[];
}

/**
 * Deterministic variable-to-basic-event mapping row for the bounded Phase 4
 * CL-QUBO export slice.
 */
export interface QuantumClQuboVariableMappingRow {
  variableIndex: number;
  variableName: string;
  basicEventId: string;
  basicEventLabel?: string;
}

/**
 * Deterministic bounded cost matrix slice for the first Phase 4 CL-QUBO export.
 *
 * This bounded package-only slice represents the decision-variable cardinality
 * objective over the feasible subspace. It is not yet the full Paper 7 encoder
 * with all downstream artifact formats.
 */
export interface QuantumClQuboCostMatrixSlice {
  format: "diagonal";
  dimension: number;
  diagonalWeights: number[];
  objective: "minimize_hamming_weight";
}

/**
 * Frozen minimal cut set reference bundle for a candidate.
 */
export interface QuantumClQuboFrozenMcsReference {
  minimalCutSetCount: number;
  basicEventIdSets: string[][];
  bitstrings: string[];
}

/**
 * Feasibility-preserving mixer specification for the bounded Phase 4 slice.
 */
export interface QuantumClQuboMixerSpecification {
  mixerFamily: "feasibilityPreserving";
  feasibleBasisStateBitstrings: string[];
  feasibleBasisStateCount: number;
  mcsBitstrings: string[];
  note: string;
}

/**
 * Statevector verification recommendation for the bounded Phase 4 slice.
 */
export interface QuantumClQuboStatevectorVerificationPlan {
  eligible: boolean;
  mode: "exact_statevector_for_n_le_8" | "not_recommended_for_n_gt_8";
  note: string;
}

/**
 * Full variable-kind inventory for a Paper 10 compatible CL-QUBO model.
 */
export type QuantumClQuboFullVariableKind = "basic" | "gate" | "aux";

/**
 * One variable row in a full CL-QUBO model.
 *
 * This mirrors the Paper 10 style artifact shape where variables are not just
 * basic events. They also include gate outputs and auxiliary reduction terms.
 */
export interface QuantumClQuboFullVariableRow {
  index: number;
  kind: QuantumClQuboFullVariableKind;
  name: string;
  sourceNodeId?: string;
  sourceNodeLabel?: string;
}

/**
 * Full QUBO payload aligned to the frozen Paper 10 style artifact family.
 */
export interface QuantumClQuboFullQuboPayload {
  const: number;
  lin: Record<string, number>;
  quad: Record<string, number>;
}

/**
 * Full Ising payload aligned to the frozen Paper 10 style artifact family.
 */
export interface QuantumClQuboFullIsingPayload {
  const: number;
  h: Record<string, number>;
  J: Record<string, number>;
}

/**
 * Full CL-QUBO model intended to converge toward the frozen Paper 10
 * `qubo_model_v1.json` artifact shape.
 *
 * This does not remove the bounded slice. It adds the richer target structure
 * needed for external frozen-artifact parity.
 */
export interface QuantumClQuboFullModel {
  status: "ok";
  encodingFamily: "paper10CompatibleMonotoneClQuboV1";
  nBasic: number;
  nVarsTotal: number;
  penaltyP: number;
  topGate: string;
  vars: QuantumClQuboFullVariableRow[];
  qubo: QuantumClQuboFullQuboPayload;
  ising: QuantumClQuboFullIsingPayload;
  subtreeId?: string;
  subtreeDir?: string;
}

/**
 * Deterministic CL-QUBO export candidate payload for the bounded Phase 4 slice.
 *
 * `fullClQuboModel` is the forward path toward Phase 4 artifact parity with the
 * frozen Paper 10 per-instance artifacts. The existing bounded fields remain so
 * current scripts do not break while the richer encoder is brought online.
 */
export interface QuantumPreparationClQuboCandidateExport {
  modelId: string;
  modelName: string;
  candidateRootNodeId: string;
  candidateRootNodeLabel?: string;
  candidateRootGateType?: NormalizedGateType;
  orderedBasicEventIds: string[];
  variableMapping: QuantumClQuboVariableMappingRow[];
  costMatrix: QuantumClQuboCostMatrixSlice;
  frozenMcsReference: QuantumClQuboFrozenMcsReference;
  mixerSpecification: QuantumClQuboMixerSpecification;
  statevectorVerificationPlan: QuantumClQuboStatevectorVerificationPlan;
  fullClQuboModel?: QuantumClQuboFullModel;
  topologyClassification?: QuantumReadinessTopologyClassification;
  requirementsAssessment?: QuantumReadinessRequirementsAssessment;
  sourceFormat: string;
  moduleVersion: string;
  exportSliceVersion: string;
}

/**
 * Deterministic CL-QUBO export bundle for the bounded Phase 4 package slice.
 */
export interface QuantumPreparationClQuboExport {
  generatedAt: string;
  moduleVersion: string;
  exportSliceVersion: string;
  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  clQuboCandidates: QuantumPreparationClQuboCandidateExport[];
}
