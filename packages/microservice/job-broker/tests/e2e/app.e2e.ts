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

const sleep = (ms: number): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, ms));

// Root directory of the input files: relative to /openpra-monorepo
const rootDir = "./packages/microservice/job-broker/tests/input/aralia/baobab";

// Create an empty array for storing all the quantify request objects
const quantifyRequests: QuantifyRequest[] = [];

// Get the names of all the XML input files in the Aralia folder
const xmlFiles = fs.readdirSync(rootDir);
xmlFiles.forEach((file) => {
  const contents = fs.readFileSync(rootDir + `/${file}`, "utf-8"); // Save the contents of each file as utf-8 string
  const contentsBase64 = Buffer.from(contents, "utf-8").toString("base64"); // Convert the utf-8 string to base64

  // Create a quantify request with generic configurations and the base64 model
  const quantifyRequest: QuantifyRequest = {
    mocus: true,
    mcub: true,
    probability: true,
    "no-indent": true,
    models: [contentsBase64],
  };
  quantifyRequests.push(quantifyRequest); // Store the quantify request in the previously created array
});

describe("Microservice", () => {
  let app: INestApplication<Server>;
  let mongod: MongoMemoryServer;
  const scramUrl = "/api/quantify/scram";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        QuantificationModule,
        ValidationModule,
        ExecutableModule,
        ConfigModule.forRoot({
          envFilePath: ".development.env", // Specify the environment file path.
          isGlobal: true, // Make configuration globally available.
          cache: true, // Enable caching of environment variables.
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
            path: "api", // Define the base path for the API.
            module: JobBrokerModule,
            children: [
              // Define child modules for specific endpoint prefixes.
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
      controllers: [JobBrokerController], // Register the controller for this module.
      providers: [JobBrokerService], // Register the service for dependency injection.
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongod.stop();
  });

  test.each(quantifyRequests)(
    "should create and queue a new quantification job for each job",
    async (quantifyRequest) => {
      for (let i = 0; i < 100; i++) {
        const response = await request(app.getHttpServer())
          .post(scramUrl)
          .send(quantifyRequest)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json");

        expect(response.status).toBe(201);
      }
    },
  );
});
