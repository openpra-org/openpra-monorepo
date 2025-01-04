import { INestApplication, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import async from "async";
import { JobBrokerModule } from "../../src/job-broker.module";
import { QuantificationConsumerModule } from "../../src/quantification/quantification-consumer.module";

describe("Quantify", () => {
  let app: INestApplication;
  let worker: INestApplication;
  let appLogger: Logger;
  let workerLogger: Logger;

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

  it("Should queue a quantification job", () => {
    return request(app.getHttpServer())
      .post("/q/quantify/scram")
      .send({
        mocus: true,
        mcub: true,
        probability: true,
        models: [
          "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPG9wc2EtbWVmPgoJPGRlZmluZS1mYXVsdC10cmVlIG5hbWU9IlBSSU1BUllfUFVSSUZJQ0FUSU9OX1NZU1RFTV9JTkRVQ0VTX0xPUyI+CgkJPGRlZmluZS1nYXRlIG5hbWU9IlgwOTkwIj4KCQkJPGxhYmVsPlBQU0lMT1M8L2xhYmVsPgoJCQk8YW5kPgoJCQkJPGdhdGUgbmFtZT0iWDEwMDAiLz4KCQkJCTxiYXNpYy1ldmVudCBuYW1lPSJYUFAwOTBMRiIvPgoJCQk8L2FuZD4KCQk8L2RlZmluZS1nYXRlPgoJCTxkZWZpbmUtZ2F0ZSBuYW1lPSJYMTAwMCI+CgkJCTxsYWJlbD5GQUlMVVJFIE9GIFNZUEhPTiBCUkVBSyBTWVNURU08L2xhYmVsPgoJCQk8YW5kPgoJCQkJPGdhdGUgbmFtZT0iWDEwMDEiLz4KCQkJCTxiYXNpYy1ldmVudCBuYW1lPSJYVlYwMFJMUCIvPgoJCQk8L2FuZD4KCQk8L2RlZmluZS1nYXRlPgoJCTxkZWZpbmUtZ2F0ZSBuYW1lPSJYMTAwMSI+CgkJCTxsYWJlbD5GQUlMVVJFIE9GIFNZUEhPTiBCUkVBSyBMSU5FIDE8L2xhYmVsPgoJCQk8b3I+CgkJCQk8YmFzaWMtZXZlbnQgbmFtZT0iWFZWMDAxTFAiLz4KCQkJCTxiYXNpYy1ldmVudCBuYW1lPSJYVlYwMDJMUCIvPgoJCQk8L29yPgoJCTwvZGVmaW5lLWdhdGU+Cgk8L2RlZmluZS1mYXVsdC10cmVlPgoJPG1vZGVsLWRhdGE+CgkJPGRlZmluZS1iYXNpYy1ldmVudCBuYW1lPSJYVlYwMDFMUCI+CgkJCTxsYWJlbD5GQUlMVVJFIE9GIFZBTFZFIDEgVE8gT1BFTjwvbGFiZWw+CgkJCTxmbG9hdCB2YWx1ZT0iMC4xMGUtMDEiLz4KCQk8L2RlZmluZS1iYXNpYy1ldmVudD4KCQk8ZGVmaW5lLWJhc2ljLWV2ZW50IG5hbWU9IlhWVjAwMkxQIj4KCQkJPGxhYmVsPkZBSUxVUkUgT0YgVkFMVkUgMiBUTyBPUEVOPC9sYWJlbD4KCQkJPGZsb2F0IHZhbHVlPSIwLjEwZS0wMSIvPgoJCTwvZGVmaW5lLWJhc2ljLWV2ZW50PgoJCTxkZWZpbmUtYmFzaWMtZXZlbnQgbmFtZT0iWFZWMDBSTFAiPgoJCQk8bGFiZWw+RkFJTFVSRSBPRiBSRURVTkRBTlQgU1lTVEVNOyBWQUxWRSBGQUlMUyBUTyBPUEVOPC9sYWJlbD4KCQkJPGZsb2F0IHZhbHVlPSIwLjEwZS0wMSIvPgoJCTwvZGVmaW5lLWJhc2ljLWV2ZW50PgoJCTxkZWZpbmUtYmFzaWMtZXZlbnQgbmFtZT0iWFBQMDkwTEYiPgoJCQk8bGFiZWw+UElQRSBCUkVBQ0ggSU4gUFVSSUZJQ0FUSU9OIFNZU1RFTTwvbGFiZWw+CgkJCTxmbG9hdCB2YWx1ZT0iMC4zMGUtMDYiLz4KCQk8L2RlZmluZS1iYXNpYy1ldmVudD4KCTwvbW9kZWwtZGF0YT4KPC9vcHNhLW1lZj4=",
        ],
      })
      .set("Accept", "application/json")
      .expect(201);
  });
});
