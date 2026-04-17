import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FaultTreeGraph } from "shared-types";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    service = module.get<QuantumReadinessService>(QuantumReadinessService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("runs graph readiness analysis end to end", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_1",
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

    const result = service.analyzeFaultTreeGraph(graph, "Backend Integration Graph");

    expect(result.normalizedFaultTree.id).toBe("backend_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
  });

  it("allows analysis options to tighten readiness limits", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_2",
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

    const result = service.analyzeFaultTreeGraph(graph, "Backend Tight Limit", {
      analysis: {
        maxBasicEvents: 2,
      },
    });

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("retrieves a stored graph by id and analyzes it", async () => {
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

    const result = await service.analyzeFaultTreeGraphById("stored_ft_1", "Stored Graph");

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result.normalizedFaultTree.id).toBe("stored_ft_1");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
  });

  it("builds execution artifacts from a local simulator preparation artifact", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_sim_1",
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

    const preparationBundle = service.analyzeFaultTreeGraphPreparationArtifacts(graph, "Backend Simulator Graph");
    const preparationArtifact = preparationBundle.preparationArtifacts[0];

    expect(preparationArtifact).toBeDefined();

    const executionBundle = service.buildExecutionArtifactsFromSimulator({
      modelId: "backend_ft_sim_1",
      subtreeId: "TOP",
      preparationArtifact,
      shots: 7,
      samplingMode: "synthetic_exact_mcs",
    });

    expect(executionBundle.executionArtifact.providerType).toBe("simulator");
    expect(executionBundle.executionArtifact.shots).toBe(7);
    expect(executionBundle.executionArtifact.rawCounts).toEqual({
      "01": 4,
      "10": 3,
    });
  });

  it("builds simulator execution artifacts to filesystem from a preparation artifact path", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_sim_fs_1",
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
    };

    const preparationBundle = service.analyzeFaultTreeGraphPreparationArtifacts(graph, "Backend Simulator FS Graph");
    const preparationArtifact = preparationBundle.preparationArtifacts[0];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-sim-service-"));
    const preparationArtifactPath = path.join(tempDir, "openpra_quantum_preparation_artifact_TOP.json");

    fs.writeFileSync(preparationArtifactPath, JSON.stringify(preparationArtifact, null, 2) + "\n", "utf8");

    const writeResult = service.buildExecutionArtifactsFromSimulatorToFilesystem(
      {
        modelId: "backend_ft_sim_fs_1",
        subtreeId: "TOP",
        sourcePreparationArtifactId: preparationArtifact.artifactId,
        preparationArtifactPath,
        shots: 5,
        samplingMode: "synthetic_exact_mcs",
      },
      tempDir,
    );

    expect(fs.existsSync(writeResult.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(writeResult.provenanceManifestPath)).toBe(true);
  });

  it("builds bounded importance service facade outputs to filesystem", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-service-"));
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

    const result = service.buildBoundedImportanceServiceFacade({
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

  it("builds execution record service stub outputs to filesystem", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-service-"));

    const result = service.buildExecutionRecordServiceStub({
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
      scriptVersion: "quantum-readiness.service.spec",
    });

    expect(result.executionRecord.jobId).toBe("job-0698");
    expect(result.executionResult?.status).toBe("completed");
    expect(fs.existsSync(result.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(result.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("throws when no stored graph nodes are found", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "missing_ft",
      nodes: [],
      edges: [],
    });

    await expect(service.analyzeFaultTreeGraphById("missing_ft")).rejects.toThrow(
      "No fault tree graph found for faultTreeId missing_ft.",
    );
  });
});
