import { Server } from "net";
import fs from "node:fs";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { RouterModule } from "@nestjs/core";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { JobBrokerModule } from "../../src/job-broker.module";
import { QuantificationModule } from "../../src/quantification/quantification.module";
import { ValidationModule } from "../../src/validation/validation.module";
import { ExecutableModule } from "../../src/executable/executable.module";
import { JobBrokerController } from "../../src/job-broker.controller";
import { JobBrokerService } from "../../src/job-broker.service";

const runQuantifyStressTest = (rootDir: string, endpoint: string, numberOfTests: number): void => {
  const quantifyRequests: QuantifyRequest[] = [];

  const xmlFiles = fs.readdirSync(rootDir);
  xmlFiles.forEach((file) => {
    const contents = fs.readFileSync(rootDir + `/${file}`, "utf-8");
    const contentsBase64 = Buffer.from(contents, "utf-8").toString("base64");
    const config: QuantifyRequest = {
      mocus: true,
      mcub: true,
      probability: true,
      "no-indent": true,
      models: [contentsBase64],
    };
    quantifyRequests.push(config);
  });

  describe("Microservice", () => {
    let app: INestApplication<Server>;
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          QuantificationModule,
          ConfigModule.forRoot({
            envFilePath: ".development.env",
            isGlobal: true,
            cache: true,
          }),
          MongooseModule.forRootAsync({
            useFactory: async () => {
              mongod = await MongoMemoryServer.create();
              const mongoUri = mongod.getUri();
              return { uri: mongoUri };
            },
          }),
          RouterModule.register([
            {
              path: "api",
              module: JobBrokerModule,
              children: [
                {
                  path: "quantify",
                  module: QuantificationModule,
                },
                {
                  path: "validate",
                  module: ValidationModule,
                },
                {
                  path: "execute",
                  module: ExecutableModule,
                },
              ],
            },
          ]),
        ],
        controllers: [JobBrokerController],
        providers: [JobBrokerService],
      }).compile();

      app = module.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await mongod.stop();
    });

    test.each(quantifyRequests)(
      "should create and queue a new quantification job for each job",
      async (quantifyRequest) => {
        for (let i = 0; i < numberOfTests; i++) {
          const response = await request(app.getHttpServer())
            .post(endpoint)
            .send(quantifyRequest)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json");

          expect(response.status).toBe(201);
        }
      },
    );
  });
};

runQuantifyStressTest("./packages/microservice/job-broker/tests/input/aralia/xml", "/api/quantify/scram", 3);
