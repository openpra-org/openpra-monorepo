import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface HttpReadinessResponse {
  normalizedFaultTree: {
    id: string;
    topNodeId: string;
  };
  report: {
    summary: {
      totalNodes: number;
      totalQuantumTractableCandidates: number;
      tractableCandidateIds?: string[];
    };
    candidates: Array<{
      rootNodeId?: string;
      unsupportedGateTypesFound?: string[];
      quantumTractable: boolean;
      exclusionReasons?: string[];
    }>;
  };
}

function loadReleaseArtifactJson(fileName: string): unknown {
  const repoRoot = process.cwd();
  const fullPath = path.join(
    repoRoot,
    "RELEASES",
    "OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_20260406_001720Z",
    "evidence",
    "tmp",
    fileName,
  );

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

describe("OpenPRA release artifact HTTP regression", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    graphModelServiceMock.getFaultTreeGraph.mockReset();
  });

  it("analyzes release artifact case 1 as tractable", async () => {
    const graph = loadReleaseArtifactJson("openpra_graph_case_1_normalized.json");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send({ graph })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.normalizedFaultTree.id).toBe("openpra_graph_case_1");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalNodes).toBe(5);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(body.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("analyzes release artifact case 2 as non tractable because of NOT", async () => {
    const graph = loadReleaseArtifactJson("openpra_graph_case_2_normalized.json");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send({ graph })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.normalizedFaultTree.id).toBe("openpra_graph_case_2");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalNodes).toBe(2);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(body.report.candidates).toHaveLength(1);
    expect(body.report.candidates[0].rootNodeId).toBe("TOP");
    expect(body.report.candidates[0].quantumTractable).toBe(false);
    expect(body.report.candidates[0].unsupportedGateTypesFound).toContain("not");
    expect(body.report.candidates[0].exclusionReasons?.join(" ")).toMatch(/Unsupported gate types present: not/i);
  });
});
