import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportWriteHttpResponse {
  outputDir: string;
  importanceComparisonReportPath: string;
}

describe("QuantumReadiness HTTP importance comparison report write", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report/write writes a report artifact", async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-importance-report-write-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report/write")
      .send({
        outputDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: {
          A: 0.2,
          B: 0.1,
        },
        classicalValues: {
          A: 0.25,
          B: 0.05,
        },
      })
      .expect(200);

    const body = response.body as ImportanceComparisonReportWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.importanceComparisonReportPath).toBe(
      path.join(outputDir, "openpra_quantum_importance_comparison_report_v1.json"),
    );
    expect(fs.existsSync(body.importanceComparisonReportPath)).toBe(true);
  });
});
