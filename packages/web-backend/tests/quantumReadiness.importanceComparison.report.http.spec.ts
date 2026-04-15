import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportHttpResponse {
  modelId: string;
  subtreeId: string;
  measureName: string;
  summary: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    missingInQuantumCount: number;
    missingInClassicalCount: number;
    exactWithinToleranceCount: number;
  };
  topDisagreements: Array<{
    basicEventId: string;
    absoluteDifference: number | null;
    status: string;
  }>;
  entries: Array<{
    basicEventId: string;
    quantumRank: number | null;
    classicalRank: number | null;
    rankDelta: number | null;
    status: string;
  }>;
}

describe("QuantumReadiness HTTP importance comparison report", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report returns a sorted report with rank deltas", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report")
      .send({
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: {
          A: 0.2,
          B: 0.1,
          C: 0.4,
        },
        classicalValues: {
          A: 0.25,
          B: 0.05,
          D: 0.3,
        },
      })
      .expect(200);

    const body = response.body as ImportanceComparisonReportHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.subtreeId).toBe("TOP");
    expect(body.measureName).toBe("birnbaum");

    expect(body.summary.quantumCount).toBe(3);
    expect(body.summary.classicalCount).toBe(3);
    expect(body.summary.commonCount).toBe(2);
    expect(body.summary.missingInQuantumCount).toBe(1);
    expect(body.summary.missingInClassicalCount).toBe(1);

    expect(body.topDisagreements.length).toBe(2);
    expect(body.topDisagreements.map((entry) => entry.basicEventId).sort()).toEqual(["A", "B"]);

    for (const entry of body.topDisagreements) {
      expect(entry.status).toBe("common");
      expect(entry.absoluteDifference).not.toBeNull();
      expect(entry.absoluteDifference as number).toBeCloseTo(0.05, 12);
    }

    expect(body.entries.length).toBe(4);
    expect(body.entries.map((entry) => entry.basicEventId).sort()).toEqual(["A", "B", "C", "D"]);
  });
});
