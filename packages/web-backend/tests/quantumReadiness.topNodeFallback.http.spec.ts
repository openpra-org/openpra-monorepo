import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1NoTopNodeIdMetadata,
  openPraNormalizedCase1NoTopNodeIdStructural,
} from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";

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
  };
}

describe("QuantumReadiness HTTP top node fallback", () => {
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

  it("POST /api/quantum-readiness/fault-tree-graph infers top node from metadata when topNodeId is missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1NoTopNodeIdMetadata),
      })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.normalizedFaultTree.id).toBe("openpra_graph_case_1_no_top_id_metadata");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalNodes).toBe(5);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(body.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("POST /api/quantum-readiness/fault-tree-graph infers top node from unique root gate when topNodeId and markers are missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1NoTopNodeIdStructural),
      })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.normalizedFaultTree.id).toBe("openpra_graph_case_1_no_top_id_structural");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalNodes).toBe(5);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(body.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id infers top node from metadata when stored graph has no topNodeId", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(
      cloneOpenPraFixture(openPraNormalizedCase1NoTopNodeIdMetadata),
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id")
      .send({
        faultTreeId: "openpra_graph_case_1_no_top_id_metadata",
      })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1_no_top_id_metadata");
    expect(body.normalizedFaultTree.id).toBe("openpra_graph_case_1_no_top_id_metadata");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalNodes).toBe(5);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(body.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });
});
