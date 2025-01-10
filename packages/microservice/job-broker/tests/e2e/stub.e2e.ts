import fs from "node:fs";
import { INestApplication, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { json, urlencoded } from "express";
import request from "supertest";
import { JobBrokerModule } from "../../src/job-broker.module";
import { QuantificationConsumerModule } from "../../src/quantification/quantification-consumer.module";

describe("Quantify", () => {
  let app: INestApplication;
  let worker: INestApplication;
  let appLogger: Logger;
  let workerLogger: Logger;

  // Read the data from XML file and convert it to base64 string
  const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/ftr10.xml", {
    encoding: "utf8",
  });
  const model = Buffer.from(xmlContent, "utf-8").toString("base64");

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JobBrokerModule],
    }).compile();

    const workerModuleRef = await Test.createTestingModule({
      imports: [QuantificationConsumerModule],
    }).compile();

    // Initialize the producer app
    app = moduleRef.createNestApplication();
    appLogger = new Logger("Producer");
    app.useLogger(appLogger);
    app.use(json({ limit: "50mb" }));
    app.use(urlencoded({ extended: true, limit: "50mb" }));
    await app.init();

    // Initialize the consumer app
    worker = workerModuleRef.createNestApplication();
    workerLogger = new Logger("Consumer");
    worker.useLogger(workerLogger);
    await worker.init();
  });

  afterAll(async () => {
    await app.close();
  });

  for (let i = 0; i < 1000; i++) {
    it("Should queue a quantification job", () => {
      return request(app.getHttpServer())
        .post("/q/quantify/scram")
        .send({
          bdd: true,
          "limit-order": 1000,
          probability: true,
          models: [model],
        })
        .set("Accept", "application/json")
        .expect(201);
    });
  }
});
