import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FaultTreeGraph } from "shared-types";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController", () => {
  let controller: QuantumReadinessController;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    controller = module.get<QuantumReadinessController>(QuantumReadinessController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("runs controller level graph readiness analysis", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Graph",
    });

    expect(result.normalizedFaultTree.id).toBe("controller_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
  });

  it("exports preparation payloads for a tractable controller level graph", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_prep_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraphPreparation({
      graph,
      modelName: "Controller Preparation Graph",
    });

    expect(result.modelId).toBe("controller_ft_prep_1");
    expect(result.totalCandidateSubtrees).toBe(1);
    expect(result.totalQuantumTractableCandidates).toBe(1);
    expect(result.preparationCandidates).toHaveLength(1);
    expect(result.preparationCandidates[0]?.candidateRootNodeId).toBe("TOP");
    expect(result.preparationCandidates[0]?.orderedBasicEventIds).toEqual(["A", "B"]);
  });

  it("accepts top-level analysis overrides and surfaces topology classification", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_topology_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Topology Graph",
      analysis: {
        includeTopologyClassification: true,
      },
    });

    expect(result.report.summary.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 1,
    });
    expect(result.report.candidates[0]?.topologyClassification?.topologyClass).toBe("unclassified");
    expect(result.summaryMarkdown).toContain("Topology Class Counts:");
  });

  it("accepts top-level analysis overrides for preparation exports", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_topology_prep_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraphPreparation({
      graph,
      modelName: "Controller Preparation Topology Graph",
      analysis: {
        includeTopologyClassification: true,
      },
    });

    expect(result.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 1,
    });
    expect(result.preparationCandidates[0]?.topologyClassification?.topologyClass).toBe("unclassified");
  });

  it("returns excluded result when analysis options are tighter", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_2",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
        {
          id: "C",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event C" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e3",
          source: "TOP",
          target: "C",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Tight Limit",
      options: {
        analysis: {
          maxBasicEvents: 2,
        },
      },
    });

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("runs controller level graph readiness analysis by id", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "stored_ft_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    });

    const result = await controller.analyzeFaultTreeGraphById({
      faultTreeId: "stored_ft_1",
      modelName: "Stored Graph",
    });

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result.normalizedFaultTree.id).toBe("stored_ft_1");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
  });

  it("runs execution workflow through simulator_local mode", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_sim_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const preparationBundle = controller.analyzeFaultTreeGraphPreparationArtifacts({
      graph,
      modelName: "Controller Simulator Graph",
    });
    const preparationArtifact = preparationBundle.preparationArtifacts[0];
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-sim-controller-"));

    const result = controller.createExecutionWorkflowRun({
      rootDir,
      inputMode: "simulator_local",
      modelId: "controller_ft_sim_1",
      subtreeId: "TOP",
      sourcePreparationArtifactId: preparationArtifact.artifactId,
      preparationArtifact,
      shots: 7,
      samplingMode: "synthetic_exact_mcs",
    });

    expect(JSON.parse(fs.readFileSync(result.workflowRun.manifestPath, "utf8")).workflowKind).toBe("execution");
    expect(fs.existsSync(result.executionWrite.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(result.executionWrite.provenanceManifestPath)).toBe(true);
  });

  it("exports preparation payloads by id", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "stored_ft_prep_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    });

    const result = await controller.analyzeFaultTreeGraphByIdPreparation({
      faultTreeId: "stored_ft_prep_1",
      modelName: "Stored Preparation Graph",
    });

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_prep_1");
    expect(result.modelId).toBe("stored_ft_prep_1");
    expect(result.totalQuantumTractableCandidates).toBe(1);
    expect(result.preparationCandidates).toHaveLength(1);
    expect(result.preparationCandidates[0]?.candidateRootNodeId).toBe("TOP");
    expect(result.preparationCandidates[0]?.orderedBasicEventIds).toEqual(["A", "B"]);
  });
  it("builds bounded importance service facade outputs through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-controller-"));
    const generatedAtUtc = "2026-04-17T17:03:17.743Z";

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A",
      recoveryMode: "exact_hardware_recovery",
      operatorAttentionRequired: false,
      boundednessStatement: SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
      quantumImportance: [
        {
          basicEventId: "BE_A",
          fussellVesely: 0.5,
          riskAchievementWorth: 2.0,
          birnbaum: 0.1,
        },
      ],
      classicalBaseline: [
        {
          basicEventId: "BE_A",
          fussellVesely: 0.5,
          riskAchievementWorth: 2.0,
          birnbaum: 0.1,
        },
      ],
      comparisonStatistics: {
        sharedBasicEventCount: 1,
        fvCorrelation: 1,
        rawCorrelation: 1,
        birnbaumCorrelation: 1,
        fvMaxAbsoluteDeviation: 0,
        rawMaxAbsoluteDeviation: 0,
        birnbaumMaxAbsoluteDeviation: 0,
        disagreementCount: 0,
      },
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc,
      caseLabel: "phase2b_row_0698__G_G348",
    };

    const result = controller.buildBoundedImportanceServiceFacade({
      rootDirectoryPath: tempDir,
      subtreeId: expectedResponse.subtreeId,
      topologyClass: expectedResponse.topologyClass,
      recoveryMode: expectedResponse.recoveryMode,
      operatorAttentionRequired: expectedResponse.operatorAttentionRequired,
      quantumImportance: expectedResponse.quantumImportance,
      classicalBaseline: expectedResponse.classicalBaseline,
      comparisonStatistics: expectedResponse.comparisonStatistics,
      provenanceManifestPath: expectedResponse.provenanceManifestPath,
      sourceRecoveryArtifactPath: expectedResponse.sourceRecoveryArtifactPath,
      generatedAtUtc: expectedResponse.generatedAtUtc,
      caseLabel: expectedResponse.caseLabel,
      expectedResponse,
    });

    expect(result.stubResult.parityAgainstExpected?.allChecksPass).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.responsePath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("builds execution record service stub outputs through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-controller-"));

    const result = controller.buildExecutionRecordServiceStub({
      rootDirectoryPath: tempDir,
      executionRecord: {
        subtreeId: "G:G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        jobId: "job-0698",
        shots: 8192,
        resilienceLevel: 0,
        status: "submitted",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        submittedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      executionResult: {
        jobId: "job-0698",
        status: "completed",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.controller.spec",
    });

    expect(result.executionRecord.jobId).toBe("job-0698");
    expect(result.executionResult?.status).toBe("completed");
    expect(fs.existsSync(result.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });
});
