import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonHttpResponse {
  modelId: string;
  subtreeId: string;
  measureName: string;
  tolerance: number;
  counts: {
    quantumCount: number;
    classicalCount: number;
    commonCount: number;
    exactWithinToleranceCount: number;
  };
  missingInQuantum: string[];
  missingInClassical: string[];
  stats: {
    meanAbsoluteDifference: number | null;
    maxAbsoluteDifference: number | null;
    spearmanRho: number | null;
  };
}

describe("QuantumReadiness HTTP importance comparison", () => {
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

  it("POST /api/quantum-readiness/importance/compare returns agreement metrics against a classical baseline", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare")
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
        tolerance: 1e-12,
      })
      .expect(200);

    const body = response.body as ImportanceComparisonHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.subtreeId).toBe("TOP");
    expect(body.measureName).toBe("birnbaum");
    expect(body.counts.quantumCount).toBe(3);
    expect(body.counts.classicalCount).toBe(3);
    expect(body.counts.commonCount).toBe(2);
    expect(body.counts.exactWithinToleranceCount).toBe(0);
    expect(body.missingInQuantum).toEqual(["D"]);
    expect(body.missingInClassical).toEqual(["C"]);
    expect(body.stats.meanAbsoluteDifference).toBeCloseTo(0.05, 12);
    expect(body.stats.maxAbsoluteDifference).toBeCloseTo(0.05, 12);
    expect(body.stats.spearmanRho).toBeCloseTo(1, 12);
  });
});
