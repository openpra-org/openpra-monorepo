import type {
  AnalyzeFaultTreeReadinessOptions,
  NormalizedFaultTree,
  NormalizedFaultTreeNode,
  QuantumClQuboCostMatrixSlice,
  QuantumClQuboFrozenMcsReference,
  QuantumClQuboFullModel,
  QuantumClQuboFullVariableRow,
  QuantumClQuboMixerSpecification,
  QuantumClQuboStatevectorVerificationPlan,
  QuantumClQuboVariableMappingRow,
  QuantumPreparationCandidatePayload,
  QuantumPreparationClQuboCandidateExport,
  QuantumPreparationClQuboExport,
  QuantumPreparationExport,
  QuantumReadinessReport,
  QuantumReadinessRequirementsAssessment,
  QuantumReadinessTopologyClassification,
} from "./types";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";

const MODULE_VERSION = "0.0.1";
const CL_QUBO_EXPORT_SLICE_VERSION = "phase4-bounded-clqubo-v1";
const FULL_CL_QUBO_ENCODING_FAMILY = "paper10CompatibleMonotoneClQuboV1";
const DEFAULT_BOUNDED_BETA = 0.2;
const DEFAULT_BOUNDED_GAMMA = 0.2;
const PHASE2B_SUBTREE_DIR_ROOT =
  "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/PaperB_reactor_models/06_phase2B_reactor_scale/03_subtrees_extracted/PHASE2B_SUBTREE_EXTRACT_v1_20260220_180901Z/per_subtree";

/**
 * Build deterministic downstream preparation payloads from an already computed readiness report.
 */
export function buildQuantumPreparationExport(
  faultTree: NormalizedFaultTree,
  report: QuantumReadinessReport,
): QuantumPreparationExport {
  return {
    generatedAt: new Date().toISOString(),
    moduleVersion: MODULE_VERSION,
    modelId: report.summary.modelId,
    modelName: report.summary.modelName,
    sourceFormat: report.summary.sourceFormat,
    configuredMaxBasicEvents: report.summary.configuredMaxBasicEvents,
    configuredSupportedGateTypes: [...report.summary.configuredSupportedGateTypes],
    totalCandidateSubtrees: report.summary.totalCandidateSubtrees,
    totalQuantumTractableCandidates: report.summary.totalQuantumTractableCandidates,
    ...(report.summary.topologyClassCounts ?
      {
        topologyClassCounts: { ...report.summary.topologyClassCounts },
      }
    : {}),
    ...(report.summary.requirementsMatrixMatchedCandidateIds ?
      {
        requirementsMatrixMatchedCandidateIds: [...report.summary.requirementsMatrixMatchedCandidateIds].sort(),
      }
    : {}),
    ...(report.summary.recommendedExecutionPriorityCandidateIds ?
      {
        recommendedExecutionPriorityCandidateIds: [...report.summary.recommendedExecutionPriorityCandidateIds].sort(),
      }
    : {}),
    preparationCandidates: report.candidates
      .filter((candidate) => candidate.quantumTractable)
      .sort((left, right) => left.rootNodeId.localeCompare(right.rootNodeId))
      .map(
        (candidate): QuantumPreparationCandidatePayload => ({
          modelId: report.summary.modelId,
          modelName: report.summary.modelName,
          candidateRootNodeId: candidate.rootNodeId,
          candidateRootNodeLabel: candidate.rootNodeLabel,
          candidateRootGateType: candidate.rootGateType,
          orderedBasicEventIds: [...candidate.basicEventIds].sort(),
          orderedGateNodeIds: [...candidate.gateNodeIds].sort(),
          orderedSubtreeNodeIds: [...candidate.subtreeNodeIds].sort(),
          supportedGateTypesFound: [...candidate.supportedGateTypesFound].sort(),
          maxDepth: candidate.maxDepth,
          basicEventCount: candidate.basicEventCount,
          gateCount: candidate.gateCount,
          ...(candidate.topologyClassification ?
            {
              topologyClassification: cloneTopologyClassification(candidate.topologyClassification),
            }
          : {}),
          ...(candidate.requirementsAssessment ?
            {
              requirementsAssessment: cloneRequirementsAssessment(candidate.requirementsAssessment),
            }
          : {}),
          sourceFormat: faultTree.sourceFormat ?? "unknown",
          moduleVersion: MODULE_VERSION,
        }),
      ),
  };
}

/**
 * Analyze a normalized fault tree and immediately export deterministic preparation payloads.
 */
export function analyzeFaultTreeQuantumPreparation(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {},
): QuantumPreparationExport {
  const report = analyzeFaultTreeReadiness(faultTree, options);
  return buildQuantumPreparationExport(faultTree, report);
}

/**
 * Build a bounded Phase 4 CL-QUBO export slice from an already computed
 * readiness report.
 *
 * This first slice is intentionally package-only and bounded to monotone
 * AND/OR trees. It constructs:
 * - deterministic decision-variable mapping
 * - a diagonal Hamming-weight objective
 * - an exact frozen MCS reference set
 * - a feasibility-preserving mixer specification
 * - the existing bounded QAOA+ recipe used by current tests and scripts
 * - statevector-verification guidance for n <= 8
 * - a forward-compatible full CL-QUBO model scaffold aligned to the Paper 10
 *   per-instance artifact family
 */
export function buildQuantumPreparationClQuboExport(
  faultTree: NormalizedFaultTree,
  report: QuantumReadinessReport,
): QuantumPreparationClQuboExport {
  return {
    generatedAt: new Date().toISOString(),
    moduleVersion: MODULE_VERSION,
    exportSliceVersion: CL_QUBO_EXPORT_SLICE_VERSION,
    modelId: report.summary.modelId,
    modelName: report.summary.modelName,
    sourceFormat: report.summary.sourceFormat,
    totalCandidateSubtrees: report.summary.totalCandidateSubtrees,
    totalQuantumTractableCandidates: report.summary.totalQuantumTractableCandidates,
    clQuboCandidates: report.candidates
      .filter((candidate) => candidate.quantumTractable)
      .sort((left, right) => left.rootNodeId.localeCompare(right.rootNodeId))
      .map((candidate) => buildClQuboCandidateExport(faultTree, report, candidate)),
  };
}

/**
 * Analyze a normalized fault tree and immediately export the bounded Phase 4
 * CL-QUBO package slice.
 */
export function analyzeFaultTreeQuantumPreparationClQuboExport(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {},
): QuantumPreparationClQuboExport {
  const report = analyzeFaultTreeReadiness(faultTree, options);
  return buildQuantumPreparationClQuboExport(faultTree, report);
}

function buildClQuboCandidateExport(
  faultTree: NormalizedFaultTree,
  report: QuantumReadinessReport,
  candidate: QuantumReadinessReport["candidates"][number],
): QuantumPreparationClQuboCandidateExport {
  const orderedBasicEventIds = [...candidate.basicEventIds].sort();

  const variableMapping = buildVariableMapping(faultTree, orderedBasicEventIds);
  const minimalCutSets = enumerateMinimalCutSets(faultTree, candidate.rootNodeId);
  const mcsBitstrings = minimalCutSets.map((cutSet) => basicEventIdsToBitstring(cutSet, orderedBasicEventIds));

  const frozenMcsReference: QuantumClQuboFrozenMcsReference = {
    minimalCutSetCount: minimalCutSets.length,
    basicEventIdSets: minimalCutSets.map((cutSet) => [...cutSet]),
    bitstrings: [...mcsBitstrings],
  };

  const mixerSpecification = buildMixerSpecification(orderedBasicEventIds, minimalCutSets);
  const costMatrix = buildDiagonalHammingWeightCostMatrix(orderedBasicEventIds.length);
  const statevectorVerificationPlan = buildStatevectorVerificationPlan(orderedBasicEventIds.length);
  const qaoaCircuitRecipe = buildBoundedQaoaCircuitRecipe(orderedBasicEventIds.length, costMatrix, mixerSpecification);
  const fullClQuboModel = buildFullClQuboModel(faultTree, report, candidate);

  const basePayload: QuantumPreparationClQuboCandidateExport = {
    modelId: report.summary.modelId,
    modelName: report.summary.modelName,
    candidateRootNodeId: candidate.rootNodeId,
    candidateRootNodeLabel: candidate.rootNodeLabel,
    candidateRootGateType: candidate.rootGateType,
    orderedBasicEventIds,
    variableMapping,
    costMatrix,
    frozenMcsReference,
    mixerSpecification,
    statevectorVerificationPlan,
    fullClQuboModel,
    ...(candidate.topologyClassification ?
      {
        topologyClassification: cloneTopologyClassification(candidate.topologyClassification),
      }
    : {}),
    ...(candidate.requirementsAssessment ?
      {
        requirementsAssessment: cloneRequirementsAssessment(candidate.requirementsAssessment),
      }
    : {}),
    sourceFormat: faultTree.sourceFormat ?? "unknown",
    moduleVersion: MODULE_VERSION,
    exportSliceVersion: CL_QUBO_EXPORT_SLICE_VERSION,
  };

  return Object.assign(basePayload, {
    qaoaCircuitRecipe,
  }) as QuantumPreparationClQuboCandidateExport;
}

function buildVariableMapping(
  faultTree: NormalizedFaultTree,
  orderedBasicEventIds: string[],
): QuantumClQuboVariableMappingRow[] {
  return orderedBasicEventIds.map((basicEventId, variableIndex) => ({
    variableIndex,
    variableName: `x${variableIndex}`,
    basicEventId,
    basicEventLabel: faultTree.nodes[basicEventId]?.label,
  }));
}

function buildDiagonalHammingWeightCostMatrix(dimension: number): QuantumClQuboCostMatrixSlice {
  return {
    format: "diagonal",
    dimension,
    diagonalWeights: Array.from({ length: dimension }, () => 1),
    objective: "minimize_hamming_weight",
  };
}

function buildMixerSpecification(
  orderedBasicEventIds: string[],
  minimalCutSets: string[][],
): QuantumClQuboMixerSpecification {
  const mcsBitstrings = minimalCutSets.map((cutSet) => basicEventIdsToBitstring(cutSet, orderedBasicEventIds));

  const feasibleBasisStateBitstrings =
    orderedBasicEventIds.length <= 8 ? enumerateFeasibleBasisStateBitstrings(orderedBasicEventIds, minimalCutSets) : [];

  return {
    mixerFamily: "feasibilityPreserving",
    feasibleBasisStateBitstrings,
    feasibleBasisStateCount: feasibleBasisStateBitstrings.length,
    mcsBitstrings,
    note:
      orderedBasicEventIds.length <= 8 ?
        "Exact feasible-basis enumeration included because n <= 8."
      : "Exact feasible-basis enumeration omitted because n > 8 in this bounded package slice.",
  };
}

function buildStatevectorVerificationPlan(basicEventCount: number): QuantumClQuboStatevectorVerificationPlan {
  if (basicEventCount <= 8) {
    return {
      eligible: true,
      mode: "exact_statevector_for_n_le_8",
      note: "Candidate is eligible for exact statevector verification in the bounded Phase 4 slice.",
    };
  }

  return {
    eligible: false,
    mode: "not_recommended_for_n_gt_8",
    note: "Candidate exceeds the bounded exact-statevector recommendation threshold of n <= 8.",
  };
}

function buildBoundedQaoaCircuitRecipe(
  qubitCount: number,
  costMatrix: QuantumClQuboCostMatrixSlice,
  mixerSpecification: QuantumClQuboMixerSpecification,
) {
  return {
    recipeVersion: "phase4-bounded-qaoa-v1",
    circuitFamily: "QAOA+",
    generationMode: "bounded_recipe_only",
    qubitCount,
    depthP: 1,
    parameterDefaults: {
      depthP: 1,
      beta: DEFAULT_BOUNDED_BETA,
      gamma: DEFAULT_BOUNDED_GAMMA,
    },
    parameterOrder: ["gamma_1", "beta_1"],
    layers: [
      {
        layerIndex: 1,
        gammaParameterName: "gamma_1",
        betaParameterName: "beta_1",
        gammaDefault: DEFAULT_BOUNDED_GAMMA,
        betaDefault: DEFAULT_BOUNDED_BETA,
      },
    ],
    initialState: {
      preparationStrategy: "uniform_superposition_over_feasible_basis",
      feasibleBasisStateBitstrings: [...mixerSpecification.feasibleBasisStateBitstrings],
      feasibleBasisStateCount: mixerSpecification.feasibleBasisStateCount,
    },
    costHamiltonian: {
      format: costMatrix.format,
      dimension: costMatrix.dimension,
      diagonalWeights: [...costMatrix.diagonalWeights],
      objective: costMatrix.objective,
    },
    mixer: {
      mixerFamily: mixerSpecification.mixerFamily,
      feasibleBasisStateBitstrings: [...mixerSpecification.feasibleBasisStateBitstrings],
      feasibleBasisStateCount: mixerSpecification.feasibleBasisStateCount,
      mcsBitstrings: [...mixerSpecification.mcsBitstrings],
      note: mixerSpecification.note,
    },
    measurementBasis: "computational",
    qiskitBlueprint: {
      backendPackage: "qiskit",
      recipeMode: "bounded_recipe_only",
      qpyEligible: true,
      parameterSymbolOrder: ["gamma_1", "beta_1"],
      note: "Bounded Phase 4 package-side QAOA+ recipe for later Qiskit materialization without reopening backend seams in this tranche.",
    },
    notes: [
      "Default bounded roadmap guidance is depth p = 1.",
      "Default bind parameters are beta = 0.2 and gamma = 0.2.",
      "Initial state is the uniform superposition over the enumerated feasible basis states.",
      "This tranche emits a deterministic recipe only and does not yet materialize a live Qiskit circuit or QPY artifact.",
    ],
  };
}

function buildFullClQuboModel(
  faultTree: NormalizedFaultTree,
  report: QuantumReadinessReport,
  candidate: QuantumReadinessReport["candidates"][number],
): QuantumClQuboFullModel {
  const subtreeNodes = buildCandidateSubtreeNodeMap(faultTree, candidate);
  const orderedBasicEventIds = [...candidate.basicEventIds].sort();

  const estimator = new FullClQuboModelBuilder(
    faultTree,
    report.summary.modelId,
    candidate.rootNodeId,
    subtreeNodes,
    orderedBasicEventIds,
    1.0,
  );
  estimator.buildConstraints();
  const penaltyP = chooseFullClQuboPenaltyP(estimator.variableCount(), orderedBasicEventIds.length);

  const builder = new FullClQuboModelBuilder(
    faultTree,
    report.summary.modelId,
    candidate.rootNodeId,
    subtreeNodes,
    orderedBasicEventIds,
    penaltyP,
  );
  builder.buildConstraints();

  for (const basicEventId of orderedBasicEventIds) {
    builder.addBasicObjective(basicEventId, 1);
  }

  return builder.toModel();
}

function buildCandidateSubtreeNodeMap(
  faultTree: NormalizedFaultTree,
  candidate: QuantumReadinessReport["candidates"][number],
): Record<string, NormalizedFaultTreeNode> {
  const out: Record<string, NormalizedFaultTreeNode> = {};

  for (const nodeId of candidate.subtreeNodeIds) {
    const node = faultTree.nodes[nodeId];
    if (!node) {
      throw new Error(`Missing candidate subtree node in fault tree: ${nodeId}`);
    }
    out[nodeId] = node;
  }

  return out;
}

function buildPhase2BStyleSubtreeId(modelId: string, candidateRootNodeId: string): string {
  const match = /^phase2b_row_(\d+)$/.exec(modelId);
  if (match) {
    return match[1].padStart(4, "0");
  }

  return candidateRootNodeId.replace(/[^A-Za-z0-9]+/g, "_");
}

function buildPhase2BStyleSubtreeDir(modelId: string, candidateRootNodeId: string): string | undefined {
  const match = /^phase2b_row_(\d+)$/.exec(modelId);
  if (!match) {
    return undefined;
  }

  return `${PHASE2B_SUBTREE_DIR_ROOT}/${buildPhase2BStyleSubtreeId(modelId, candidateRootNodeId)}`;
}

function chooseFullClQuboPenaltyP(nVars: number, nBasic: number): number {
  return roundNumber(10.0 * (nBasic + 1) + 0.5 * nVars);
}

class FullClQuboModelBuilder {
  private readonly variableRows: QuantumClQuboFullVariableRow[] = [];
  private readonly nodeIdToVariableIndex = new Map<string, number>();
  private readonly lin = new Map<number, number>();
  private readonly quad = new Map<string, number>();
  private constant = 0;
  private auxCounter = 0;

  public constructor(
    private readonly faultTree: NormalizedFaultTree,
    private readonly modelId: string,
    private readonly candidateRootNodeId: string,
    private readonly subtreeNodes: Record<string, NormalizedFaultTreeNode>,
    orderedBasicEventIds: string[],
    public readonly penaltyP: number,
  ) {
    for (const basicEventId of orderedBasicEventIds) {
      this.registerNodeVariable(basicEventId, "basic", buildBasicVariableName(basicEventId));
    }
  }

  public variableCount(): number {
    return this.variableRows.length;
  }

  public requireNode(nodeId: string): NormalizedFaultTreeNode {
    const node = this.subtreeNodes[nodeId];
    if (!node) {
      throw new Error(`Missing node in candidate subtree map: ${nodeId}`);
    }
    return node;
  }

  public addBasicObjective(nodeId: string, weight: number): void {
    const variableIndex = this.idxBasic(nodeId);
    this.addLinear(variableIndex, weight);
  }

  public buildConstraints(): void {
    const seen = new Set<string>();

    const binarizeList = (op: "and" | "or", inputs: number[], outY: number): void => {
      if (inputs.length === 0) {
        return;
      }

      if (inputs.length === 1) {
        const x = inputs[0];
        this.addLinear(outY, this.penaltyP);
        this.addLinear(x, this.penaltyP);
        this.addQuadratic(outY, x, -2.0 * this.penaltyP);
        return;
      }

      let current = inputs[0];
      for (let offset = 1; offset < inputs.length; offset += 1) {
        const next = inputs[offset];
        const isLast = offset === inputs.length - 1;
        const y = isLast ? outY : this.createAuxVariable(`${op}_out`);

        if (op === "and") {
          this.addBinaryAndConstraint(y, current, next);
        } else {
          const tAb = this.createAuxVariable("or_ab");
          this.addBinaryAndConstraint(tAb, current, next);
          this.addBinaryOrConstraint(current, next, y, tAb);
        }

        current = y;
      }
    };

    const walkGate = (nodeId: string): void => {
      if (seen.has(nodeId)) {
        return;
      }

      const node = this.requireNode(nodeId);
      if (node.kind !== "gate") {
        throw new Error(`Expected gate node while building constraints at ${nodeId}`);
      }

      this.idxGate(nodeId);
      seen.add(nodeId);

      const outY = this.idxGate(nodeId);
      const childIndices: number[] = [];

      for (const childId of node.children ?? []) {
        childIndices.push(this.resolveNodeRef(childId));
        const childNode = this.requireNode(childId);
        if (childNode.kind === "gate") {
          walkGate(childId);
        }
      }

      const gateType = node.gateType;
      if (gateType !== "and" && gateType !== "or") {
        throw new Error(
          `Full CL-QUBO model currently supports monotone AND/OR trees only. Found ${gateType ?? "unknown"} at ${nodeId}.`,
        );
      }

      binarizeList(gateType, childIndices, outY);
    };

    walkGate(this.candidateRootNodeId);

    const topIndex = this.idxGate(this.candidateRootNodeId);
    this.addConst(this.penaltyP);
    this.addLinear(topIndex, -this.penaltyP);
  }

  public createAuxVariable(auxKind: "or_ab" | "or_out" | "and_out"): number {
    this.auxCounter += 1;
    return this.registerStandaloneVariable("aux", `AUX:${auxKind}:${String(this.auxCounter).padStart(4, "0")}`);
  }

  public addBinaryAndConstraint(zIndex: number, xIndex: number, yIndex: number): void {
    const p = this.penaltyP;
    this.addQuadratic(xIndex, yIndex, p);
    this.addQuadratic(xIndex, zIndex, -2.0 * p);
    this.addQuadratic(yIndex, zIndex, -2.0 * p);
    this.addLinear(zIndex, 3.0 * p);
  }

  public addBinaryOrConstraint(aIndex: number, bIndex: number, yIndex: number, tAbIndex: number): void {
    const p = this.penaltyP;

    this.addLinear(aIndex, p);
    this.addQuadratic(aIndex, yIndex, -p);

    this.addLinear(bIndex, p);
    this.addQuadratic(bIndex, yIndex, -p);

    this.addLinear(yIndex, p);
    this.addQuadratic(aIndex, yIndex, -p);
    this.addQuadratic(bIndex, yIndex, -p);
    this.addQuadratic(tAbIndex, yIndex, p);
  }

  public toModel(): QuantumClQuboFullModel {
    const quboLin = mapNumberKeyedEntries(this.lin);
    const quboQuad = mapQuadraticEntries(this.quad);
    const ising = buildIsingFromQubo(this.constant, this.lin, this.quad, this.variableRows.length);

    return {
      status: "ok",
      encodingFamily: FULL_CL_QUBO_ENCODING_FAMILY,
      nBasic: this.variableRows.filter((row) => row.kind === "basic").length,
      nVarsTotal: this.variableRows.length,
      penaltyP: this.penaltyP,
      topGate: stripGatePrefix(this.candidateRootNodeId),
      vars: this.variableRows.map((row) => ({ ...row })),
      qubo: {
        const: roundNumber(this.constant),
        lin: quboLin,
        quad: quboQuad,
      },
      ising,
      subtreeId: buildPhase2BStyleSubtreeId(this.modelId, this.candidateRootNodeId),
      subtreeDir: buildPhase2BStyleSubtreeDir(this.modelId, this.candidateRootNodeId),
    };
  }

  private idxBasic(nodeId: string): number {
    return this.registerNodeVariable(nodeId, "basic", buildBasicVariableName(nodeId));
  }

  private idxGate(nodeId: string): number {
    return this.registerNodeVariable(nodeId, "gate", nodeId);
  }

  private resolveNodeRef(nodeId: string): number {
    const node = this.requireNode(nodeId);
    return node.kind === "basicEvent" ? this.idxBasic(nodeId) : this.idxGate(nodeId);
  }

  private registerNodeVariable(nodeId: string, kind: QuantumClQuboFullVariableRow["kind"], name: string): number {
    const existing = this.nodeIdToVariableIndex.get(nodeId);
    if (existing !== undefined) {
      return existing;
    }

    const index = this.variableRows.length;
    this.variableRows.push({
      index,
      kind,
      name,
    });
    this.nodeIdToVariableIndex.set(nodeId, index);
    return index;
  }

  private registerStandaloneVariable(kind: QuantumClQuboFullVariableRow["kind"], name: string): number {
    const index = this.variableRows.length;
    this.variableRows.push({
      index,
      kind,
      name,
    });
    return index;
  }

  private addConst(delta: number): void {
    this.constant = roundNumber(this.constant + delta);
  }

  private addLinear(variableIndex: number, delta: number): void {
    const previous = this.lin.get(variableIndex) ?? 0;
    this.lin.set(variableIndex, roundNumber(previous + delta));
  }

  private addQuadratic(leftIndex: number, rightIndex: number, delta: number): void {
    const [small, large] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex];
    const key = `${small},${large}`;
    const previous = this.quad.get(key) ?? 0;
    this.quad.set(key, roundNumber(previous + delta));
  }
}

function buildBasicVariableName(basicEventId: string): string {
  return `BE:${basicEventId.replace(/:/g, "_")}`;
}

function stripGatePrefix(nodeId: string): string {
  return nodeId.startsWith("G:") ? nodeId.slice(2) : nodeId;
}

function mapNumberKeyedEntries(source: Map<number, number>): Record<string, number> {
  return Object.fromEntries(
    [...source.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([key, value]) => [String(key), roundNumber(value)]),
  );
}

function mapQuadraticEntries(source: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...source.entries()]
      .sort((left, right) => compareQuadraticKeys(left[0], right[0]))
      .map(([key, value]) => [key, roundNumber(value)]),
  );
}

function compareQuadraticKeys(left: string, right: string): number {
  const [leftA, leftB] = left.split(",").map((value) => Number.parseInt(value, 10));
  const [rightA, rightB] = right.split(",").map((value) => Number.parseInt(value, 10));

  if (leftA !== rightA) {
    return leftA - rightA;
  }

  return leftB - rightB;
}

function buildIsingFromQubo(
  quboConst: number,
  quboLin: Map<number, number>,
  quboQuad: Map<string, number>,
  variableCount: number,
): QuantumClQuboFullModel["ising"] {
  let isingConst = quboConst;
  const h = new Map<number, number>();
  const J = new Map<string, number>();

  for (let variableIndex = 0; variableIndex < variableCount; variableIndex += 1) {
    const linear = quboLin.get(variableIndex) ?? 0;
    isingConst += linear / 2;
    h.set(variableIndex, roundNumber((h.get(variableIndex) ?? 0) - linear / 2));
  }

  for (const [key, quadratic] of quboQuad.entries()) {
    const [leftIndexText, rightIndexText] = key.split(",");
    const leftIndex = Number.parseInt(leftIndexText, 10);
    const rightIndex = Number.parseInt(rightIndexText, 10);

    isingConst += quadratic / 4;
    h.set(leftIndex, roundNumber((h.get(leftIndex) ?? 0) - quadratic / 4));
    h.set(rightIndex, roundNumber((h.get(rightIndex) ?? 0) - quadratic / 4));
    J.set(key, roundNumber(quadratic / 4));
  }

  return {
    const: roundNumber(isingConst),
    h: Object.fromEntries(
      [...h.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([key, value]) => [String(key), roundNumber(value)]),
    ),
    J: Object.fromEntries(
      [...J.entries()]
        .sort((left, right) => compareQuadraticKeys(left[0], right[0]))
        .map(([key, value]) => [key, roundNumber(value)]),
    ),
  };
}

function enumerateMinimalCutSets(faultTree: NormalizedFaultTree, nodeId: string): string[][] {
  const node = faultTree.nodes[nodeId];
  if (!node) {
    throw new Error(`Missing node reference while enumerating minimal cut sets: ${nodeId}`);
  }

  if (node.kind === "basicEvent") {
    return [[node.id]];
  }

  const children = node.children ?? [];
  if (children.length === 0) {
    throw new Error(`Gate node ${node.id} has no children for minimal cut set enumeration.`);
  }

  if (node.gateType === "or") {
    const unioned = children.flatMap((childId) => enumerateMinimalCutSets(faultTree, childId));
    return minimizeCutSets(unioned);
  }

  if (node.gateType === "and") {
    let accumulated: string[][] = [[]];

    for (const childId of children) {
      const childCutSets = enumerateMinimalCutSets(faultTree, childId);
      const nextAccumulated: string[][] = [];

      for (const leftSet of accumulated) {
        for (const rightSet of childCutSets) {
          nextAccumulated.push(uniqueSortedStrings([...leftSet, ...rightSet]));
        }
      }

      accumulated = minimizeCutSets(nextAccumulated);
    }

    return minimizeCutSets(accumulated);
  }

  throw new Error(
    `Bounded Phase 4 CL-QUBO export only supports monotone AND/OR trees. Unsupported gate type at ${node.id}: ${node.gateType ?? "unknown"}.`,
  );
}

function minimizeCutSets(cutSets: string[][]): string[][] {
  const normalized = uniqueNormalizedCutSets(cutSets).sort(compareStringArraysByLengthThenLexical);
  const kept: string[][] = [];

  for (const candidate of normalized) {
    const isSupersetOfExisting = kept.some((existing) => isSuperset(candidate, existing));
    if (!isSupersetOfExisting) {
      kept.push(candidate);
    }
  }

  return kept;
}

function uniqueNormalizedCutSets(cutSets: string[][]): string[][] {
  const seen = new Set<string>();
  const normalized: string[][] = [];

  for (const cutSet of cutSets) {
    const canonical = uniqueSortedStrings(cutSet);
    const key = canonical.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(canonical);
    }
  }

  return normalized;
}

function enumerateFeasibleBasisStateBitstrings(orderedBasicEventIds: string[], minimalCutSets: string[][]): string[] {
  if (orderedBasicEventIds.length > 8) {
    return [];
  }

  const feasible: string[] = [];
  const cutSetLookup = minimalCutSets.map((cutSet) => new Set(cutSet));
  const totalStates = 1 << orderedBasicEventIds.length;

  for (let state = 0; state < totalStates; state += 1) {
    const activeBasicEvents = new Set<string>();

    for (let index = 0; index < orderedBasicEventIds.length; index += 1) {
      if (((state >> index) & 1) === 1) {
        activeBasicEvents.add(orderedBasicEventIds[index]);
      }
    }

    const isFeasible = cutSetLookup.some((cutSet) =>
      [...cutSet].every((basicEventId) => activeBasicEvents.has(basicEventId)),
    );

    if (isFeasible) {
      feasible.push(activeBasicEventIdsToBitstring(activeBasicEvents, orderedBasicEventIds));
    }
  }

  return feasible.sort();
}

function basicEventIdsToBitstring(basicEventIds: string[], orderedBasicEventIds: string[]): string {
  return activeBasicEventIdsToBitstring(new Set(basicEventIds), orderedBasicEventIds);
}

function activeBasicEventIdsToBitstring(activeBasicEventIds: Set<string>, orderedBasicEventIds: string[]): string {
  return orderedBasicEventIds.map((basicEventId) => (activeBasicEventIds.has(basicEventId) ? "1" : "0")).join("");
}

function isSuperset(candidate: string[], reference: string[]): boolean {
  if (candidate.length < reference.length) {
    return false;
  }

  const candidateSet = new Set(candidate);
  return reference.every((value) => candidateSet.has(value));
}

function compareStringArraysByLengthThenLexical(left: string[], right: string[]): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }

  const leftKey = left.join("|");
  const rightKey = right.join("|");
  return leftKey.localeCompare(rightKey);
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneTopologyClassification(
  topologyClassification: QuantumReadinessTopologyClassification,
): QuantumReadinessTopologyClassification {
  return {
    topologyClass: topologyClassification.topologyClass,
    classificationRuleVersion: topologyClassification.classificationRuleVersion,
    reasons: [...topologyClassification.reasons].sort(),
    rootChildNodeIds: [...topologyClassification.rootChildNodeIds].sort(),
    rootChildBasicEventCount: topologyClassification.rootChildBasicEventCount,
    rootChildAndGateCount: topologyClassification.rootChildAndGateCount,
    rootChildOrGateCount: topologyClassification.rootChildOrGateCount,
    rootChildOtherGateCount: topologyClassification.rootChildOtherGateCount,
  };
}

function cloneRequirementsAssessment(
  requirementsAssessment: QuantumReadinessRequirementsAssessment,
): QuantumReadinessRequirementsAssessment {
  return {
    requiredQubits: requirementsAssessment.requiredQubits,
    matrixEntryMatched: requirementsAssessment.matrixEntryMatched,
    ...(requirementsAssessment.matrixEntry ?
      {
        matrixEntry: { ...requirementsAssessment.matrixEntry },
      }
    : {}),
    hardwareCompatibility: requirementsAssessment.hardwareCompatibility
      .map((row) => ({ ...row }))
      .sort((left, right) => left.platformId.localeCompare(right.platformId)),
    preferredDepthP: 1,
    avoidRL1: true,
    preferredAlgorithm: "QAOA+",
    executionPriority: requirementsAssessment.executionPriority,
    guidanceNotes: [...requirementsAssessment.guidanceNotes].sort(),
  };
}

function roundNumber(value: number): number {
  return Number.parseFloat(value.toFixed(12));
}
