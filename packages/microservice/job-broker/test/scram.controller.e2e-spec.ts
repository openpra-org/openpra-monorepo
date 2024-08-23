import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ConfigService } from "@nestjs/config";
import { JobBrokerModule } from "../src/job-broker.module";
import { ProducerService } from "../src/quantification/services/producer.service";

describe("ScramController (e2e)", () => {
  let app: INestApplication;
  let producerService: ProducerService;
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [JobBrokerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    producerService = moduleFixture.get<ProducerService>(ProducerService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("/api/quantification/scram-quantification (POST)", () => {
    const mockQuantRequest = {
      bdd: true,
      mcub: true,
      probability: true,
    };

    jest.spyOn(producerService, "createAndQueueQuant").mockResolvedValue();

    return request(app.getHttpServer())
      .post("/api/quantification/scram-quantification")
      .send(mockQuantRequest)
      .expect(201);
  });

  it("/api/quantification/scram-quantification (POST) - handles internal server error", () => {
    const mockQuantRequest = {
      bdd: true,
      mcub: true,
      probability: true,
      models: ["model 1"],
    };

    jest.spyOn(producerService, "createAndQueueQuant").mockRejectedValue(new Error("Mock error"));

    return request(app.getHttpServer())
      .post("/api/quantification/scram-quantification")
      .send(mockQuantRequest)
      .expect(500)
      .expect({
        statusCode: 500,
        message: "Server encountered a problem while queueing SCRAM quantification job.",
      });
  });
});
