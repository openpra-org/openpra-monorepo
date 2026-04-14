import {
  analyzeFaultTreeQuantumPreparation,
  analyzeFaultTreeQuantumPreparationClQuboExport,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
} from "./quantum-preparation";
import { analyzeFaultTreeReadiness } from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("quantum-preparation", () => {
  function buildA5ProofTree(): NormalizedFaultTree {
    return {
      id: "prep-ft-a5",
      name: "Preparation A5 Proof Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "G2", "E"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["C", "D"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        D: { id: "D", kind: "basicEvent" },
        E: { id: "E", kind: "basicEvent" },
      },
    };
  }

  function expectA5FullClQuboModel(top: { fullClQuboModel?: any } | undefined): void {
    const full = top?.fullClQuboModel;

    expect(full).toBeDefined();
    expect(full).toMatchObject({
      status: "ok",
      encodingFamily: "paper10CompatibleMonotoneClQuboV1",
      nBasic: 5,
      nVarsTotal: 11,
      penaltyP: 65.5,
      topGate: "TOP",
      subtreeId: "TOP",
    });

    expect(full?.vars).toHaveLength(11);
    expect(full?.vars).toEqual([
      {
        index: 0,
        kind: "basic",
        name: "BE:A",
      },
      {
        index: 1,
        kind: "basic",
        name: "BE:B",
      },
      {
        index: 2,
        kind: "basic",
        name: "BE:C",
      },
      {
        index: 3,
        kind: "basic",
        name: "BE:D",
      },
      {
        index: 4,
        kind: "basic",
        name: "BE:E",
      },
      {
        index: 5,
        kind: "gate",
        name: "TOP",
      },
      {
        index: 6,
        kind: "gate",
        name: "G1",
      },
      {
        index: 7,
        kind: "gate",
        name: "G2",
      },
      {
        index: 8,
        kind: "aux",
        name: "AUX:or_out:0001",
      },
      {
        index: 9,
        kind: "aux",
        name: "AUX:or_ab:0002",
      },
      {
        index: 10,
        kind: "aux",
        name: "AUX:or_ab:0003",
      },
    ]);

    expect(full?.qubo).toEqual({
      const: 65.5,
      lin: {
        "0": 1,
        "1": 1,
        "2": 1,
        "3": 1,
        "4": 66.5,
        "5": 0,
        "6": 262,
        "7": 262,
        "8": 131,
        "9": 196.5,
        "10": 196.5,
      },
      quad: {
        "0,1": 65.5,
        "0,6": -131,
        "1,6": -131,
        "2,3": 65.5,
        "2,7": -131,
        "3,7": -131,
        "4,5": -131,
        "4,8": 65.5,
        "4,10": -131,
        "5,8": -131,
        "5,10": 65.5,
        "6,7": 65.5,
        "6,8": -131,
        "6,9": -131,
        "7,8": -131,
        "7,9": -131,
        "8,9": 65.5,
        "8,10": -131,
      },
    });

    expect(full?.ising).toEqual({
      const: 330,
      h: {
        "0": 15.875,
        "1": 15.875,
        "2": 15.875,
        "3": 15.875,
        "4": 15.875,
        "5": 49.125,
        "6": -16.375,
        "7": -16.375,
        "8": 32.75,
        "9": -49.125,
        "10": -49.125,
      },
      J: {
        "0,1": 16.375,
        "0,6": -32.75,
        "1,6": -32.75,
        "2,3": 16.375,
        "2,7": -32.75,
        "3,7": -32.75,
        "4,5": -32.75,
        "4,8": 16.375,
        "4,10": -32.75,
        "5,8": -32.75,
        "5,10": 16.375,
        "6,7": 16.375,
        "6,8": -32.75,
        "6,9": -32.75,
        "7,8": -32.75,
        "7,9": -32.75,
        "8,9": 16.375,
        "8,10": -32.75,
      },
    });
  }

  it("exports deterministic preparation payloads for tractable candidates", () => {
    const tree: NormalizedFaultTree = {
      id: "prep-ft-1",
      name: "Preparation Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "C"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"],
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
      },
    };

    const report = analyzeFaultTreeReadiness(tree);
    const exported = buildQuantumPreparationExport(tree, report);

    expect(exported.modelId).toBe("prep-ft-1");
    expect(exported.totalCandidateSubtrees).toBe(2);
    expect(exported.totalQuantumTractableCandidates).toBe(2);
    expect(exported.preparationCandidates).toHaveLength(2);

    const g1 = exported.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "G1");
    const top = exported.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(g1?.orderedBasicEventIds).toEqual(["A", "B"]);
    expect(g1?.orderedGateNodeIds).toEqual(["G1"]);
    expect(g1?.candidateRootGateType).toBe("and");

    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "C"]);
    expect(top?.orderedGateNodeIds).toEqual(["G1", "TOP"]);
    expect(top?.candidateRootGateType).toBe("or");
  });

  it("exports no preparation payloads for non tractable candidates", () => {
    const tree: NormalizedFaultTree = {
      id: "prep-ft-not",
      name: "Preparation NOT Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "not",
          children: ["A"],
        },
        A: { id: "A", kind: "basicEvent" },
      },
    };

    const exported = analyzeFaultTreeQuantumPreparation(tree);

    expect(exported.modelId).toBe("prep-ft-not");
    expect(exported.totalCandidateSubtrees).toBe(1);
    expect(exported.totalQuantumTractableCandidates).toBe(0);
    expect(exported.preparationCandidates).toEqual([]);
  });

  it("keeps preparation candidate ordering deterministic", () => {
    const tree: NormalizedFaultTree = {
      id: "prep-ft-ordering",
      name: "Preparation Ordering Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G2", "G1"],
        },
        G2: {
          id: "G2",
          kind: "gate",
          gateType: "and",
          children: ["D", "C"],
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["B", "A"],
        },
        D: { id: "D", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        A: { id: "A", kind: "basicEvent" },
      },
    };

    const exported = analyzeFaultTreeQuantumPreparation(tree);

    expect(exported.preparationCandidates.map((candidate) => candidate.candidateRootNodeId)).toEqual([
      "G1",
      "G2",
      "TOP",
    ]);

    const top = exported.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "C", "D"]);
    expect(top?.orderedGateNodeIds).toEqual(["G1", "G2", "TOP"]);
    expect(top?.orderedSubtreeNodeIds).toEqual(["A", "B", "C", "D", "G1", "G2", "TOP"]);
  });

  it("carries topology classification fields into the preparation export when enabled", () => {
    const tree = buildA5ProofTree();

    const report = analyzeFaultTreeReadiness(tree, {
      includeTopologyClassification: true,
    });
    const exported = buildQuantumPreparationExport(tree, report);

    expect(exported.topologyClassCounts).toEqual({
      A: 1,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });

    const top = exported.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.topologyClassification?.topologyClass).toBe("A");
    expect(top?.topologyClassification?.classificationRuleVersion).toBe("phase3-bounded-v1");
    expect(top?.topologyClassification?.rootChildBasicEventCount).toBe(1);
    expect(top?.topologyClassification?.rootChildAndGateCount).toBe(2);
    expect(top?.topologyClassification?.rootChildOrGateCount).toBe(0);
  });

  it("carries requirements matrix and hardware compatibility fields into the preparation export when enabled", () => {
    const tree = buildA5ProofTree();

    const exported = analyzeFaultTreeQuantumPreparation(tree, {
      includeRequirementsMatrix: true,
    });

    expect(exported.topologyClassCounts).toEqual({
      A: 1,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });
    expect(exported.requirementsMatrixMatchedCandidateIds).toEqual(["TOP"]);
    expect(exported.recommendedExecutionPriorityCandidateIds).toEqual(["TOP"]);

    const top = exported.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.requirementsAssessment?.matrixEntryMatched).toBe(true);
    expect(top?.requirementsAssessment?.matrixEntry).toEqual({
      topologyClass: "A",
      nBasic: 5,
      requiredQubits: 5,
      estimatedDepthP1: 305,
      estimatedDepthP2: 514,
      thresholdStatus: "favorable",
      evidenceTier: "projected",
    });
    expect(top?.requirementsAssessment?.executionPriority).toBe("high");
    expect(top?.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);
  });

  it("builds a bounded CL-QUBO export slice with exact MCS reference sets for the A5 proof case", () => {
    const tree = buildA5ProofTree();

    const report = analyzeFaultTreeReadiness(tree, {
      includeRequirementsMatrix: true,
    });
    const exported = buildQuantumPreparationClQuboExport(tree, report);

    expect(exported.modelId).toBe("prep-ft-a5");
    expect(exported.exportSliceVersion).toBe("phase4-bounded-clqubo-v1");
    expect(exported.totalCandidateSubtrees).toBe(3);
    expect(exported.totalQuantumTractableCandidates).toBe(3);
    expect(exported.clQuboCandidates).toHaveLength(3);

    const top = exported.clQuboCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "C", "D", "E"]);
    expect(top?.variableMapping.map((row) => row.variableName)).toEqual(["x0", "x1", "x2", "x3", "x4"]);
    expect(top?.costMatrix).toEqual({
      format: "diagonal",
      dimension: 5,
      diagonalWeights: [1, 1, 1, 1, 1],
      objective: "minimize_hamming_weight",
    });
    expect(top?.frozenMcsReference).toEqual({
      minimalCutSetCount: 3,
      basicEventIdSets: [["E"], ["A", "B"], ["C", "D"]],
      bitstrings: ["00001", "11000", "00110"],
    });
    expect(top?.mixerSpecification.mixerFamily).toBe("feasibilityPreserving");
    expect(top?.mixerSpecification.feasibleBasisStateCount).toBe(23);
    expect(top?.mixerSpecification.mcsBitstrings).toEqual(["00001", "11000", "00110"]);
    expect(top?.statevectorVerificationPlan).toEqual({
      eligible: true,
      mode: "exact_statevector_for_n_le_8",
      note: "Candidate is eligible for exact statevector verification in the bounded Phase 4 slice.",
    });
  });

  it("adds a Paper10 compatible full CL-QUBO model scaffold for the A5 proof case", () => {
    const tree = buildA5ProofTree();

    const exported = analyzeFaultTreeQuantumPreparationClQuboExport(tree, {
      includeRequirementsMatrix: true,
    });

    const top = exported.clQuboCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expectA5FullClQuboModel(top);
    expect(top?.requirementsAssessment?.requiredQubits).toBe(5);
    expect(top?.fullClQuboModel?.nVarsTotal).toBe(11);
  });

  it("adds a bounded QAOA+ circuit recipe with default parameters for the A5 proof case", () => {
    const tree = buildA5ProofTree();

    const exported = analyzeFaultTreeQuantumPreparationClQuboExport(tree, {
      includeRequirementsMatrix: true,
    });

    const top = exported.clQuboCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.qaoaCircuitRecipe).toEqual({
      recipeVersion: "phase4-bounded-qaoa-v1",
      circuitFamily: "QAOA+",
      generationMode: "bounded_recipe_only",
      qubitCount: 5,
      depthP: 1,
      parameterDefaults: {
        depthP: 1,
        beta: 0.2,
        gamma: 0.2,
      },
      parameterOrder: ["gamma_1", "beta_1"],
      layers: [
        {
          layerIndex: 1,
          gammaParameterName: "gamma_1",
          betaParameterName: "beta_1",
          gammaDefault: 0.2,
          betaDefault: 0.2,
        },
      ],
      initialState: {
        preparationStrategy: "uniform_superposition_over_feasible_basis",
        feasibleBasisStateBitstrings: top?.mixerSpecification.feasibleBasisStateBitstrings,
        feasibleBasisStateCount: 23,
      },
      costHamiltonian: {
        format: "diagonal",
        dimension: 5,
        diagonalWeights: [1, 1, 1, 1, 1],
        objective: "minimize_hamming_weight",
      },
      mixer: {
        mixerFamily: "feasibilityPreserving",
        feasibleBasisStateBitstrings: top?.mixerSpecification.feasibleBasisStateBitstrings,
        feasibleBasisStateCount: 23,
        mcsBitstrings: ["00001", "11000", "00110"],
        note: "Exact feasible-basis enumeration included because n <= 8.",
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
    });

    expect(top?.requirementsAssessment?.executionPriority).toBe("high");
    expect(top?.requirementsAssessment?.preferredAlgorithm).toBe("QAOA+");
  });
});
