import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalCasePack.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the canonical case pack summary", async () => {
    const response = await request(app.getHttpServer()).post("/canonical-case-pack/summary").send({}).expect(200);

    expect(response.body.ws5PriorityCases.map((entry: { caseLabel: string }) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);

    expect(response.body.ws6AcceptanceCases.map((entry: { caseLabel: string }) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});
