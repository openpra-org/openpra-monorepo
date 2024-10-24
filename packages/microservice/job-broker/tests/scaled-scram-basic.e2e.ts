import { Server } from "net";
import fs from "node:fs";
import { performance } from "perf_hooks";
import os from "os";
import { INestApplication, Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { RouterModule } from "@nestjs/core";
import request from "supertest";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import mongoose from "mongoose";
import { JobBrokerModule } from "../src/job-broker.module";
import { QuantificationModule } from "../src/quantification/quantification.module";
import { ValidationModule } from "../src/validation/validation.module";
import { ExecutableModule } from "../src/executable/executable.module";
import { JobBrokerController } from "../src/job-broker.controller";
import { JobBrokerService } from "../src/job-broker.service";

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

  describe("Microservice Stress Test", () => {
    const apps: INestApplication<Server>[] = [];
    let logger: Logger;

    beforeAll(async () => {
      logger = new Logger("StressTest");
      const numInstances = 5; // Number of app instances

      for (let i = 0; i < numInstances; i++) {
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            QuantificationModule,
            ConfigModule.forRoot({
              envFilePath: ".development.env",
              isGlobal: true,
              cache: true,
            }),
            MongooseModule.forRootAsync({
              imports: [ConfigModule],
              useFactory: (configService: ConfigService) => {
                const mongoUri = configService.get<string>("MONGO_TEST_URI");
                if (!mongoUri) {
                  throw new Error("MONGO_TEST_URI is not defined in environment variables");
                }
                return { uri: mongoUri };
              },
              inject: [ConfigService],
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

        const app = module.createNestApplication();
        app.useLogger(logger);
        await app.init();
        apps.push(app);
      }
    });

    afterAll(async () => {
      for (const app of apps) {
        await app.close();
        const connection = app.get<mongoose.Connection>(mongoose.Connection);
        // Drop the database only once to avoid errors
        if (app === apps[0]) {
          await connection.dropDatabase();
        }
      }
    });

    it("should process requests and collect metrics", async () => {
      const latencies: number[] = [];
      let totalRequestsSent = 0;
      let totalResponsesReceived = 0;
      const resourceUsageSamples: {
        timestamp: number;
        cpuUsage: number;
        memoryUsage: number;
      }[] = [];
      const startTime = performance.now();
      let lastCpuUsage = process.cpuUsage();

      const resourceUsageInterval = setInterval(() => {
        const timestamp = performance.now();
        const currentCpuUsage = process.cpuUsage();
        const cpuUsageDiff = {
          user: currentCpuUsage.user - lastCpuUsage.user,
          system: currentCpuUsage.system - lastCpuUsage.system,
        };
        lastCpuUsage = currentCpuUsage;
        const cpuUsagePercent = (cpuUsageDiff.user + cpuUsageDiff.system) / 1000 / (os.cpus().length * 1000);
        const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
        resourceUsageSamples.push({
          timestamp,
          cpuUsage: cpuUsagePercent,
          memoryUsage,
        });
      }, 1000);

      const requests: Promise<void>[] = [];
      let appIndex = 0; // For round-robin distribution

      for (const quantifyRequest of quantifyRequests) {
        for (let i = 0; i < numberOfTests; i++) {
          totalRequestsSent++;
          const sendTime = performance.now();
          const currentApp = apps[appIndex % apps.length];
          appIndex++;

          const reqPromise = request(currentApp.getHttpServer())
            .post(endpoint)
            .send(quantifyRequest)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .then((response) => {
              const receiveTime = performance.now();
              const latency = receiveTime - sendTime;
              latencies.push(latency);
              totalResponsesReceived++;
              expect(response.status).toBe(201);
            })
            .catch((error: unknown) => {
              const receiveTime = performance.now();
              const latency = receiveTime - sendTime;
              latencies.push(latency);
              totalResponsesReceived++;
              logger.error("Request failed:", error);
            });
          requests.push(reqPromise);
        }
      }

      // Execute all requests concurrently
      await Promise.all(requests);

      clearInterval(resourceUsageInterval);
      const endTime = performance.now();
      const totalTime = (endTime - startTime) / 1000;
      const throughput = totalResponsesReceived / totalTime;
      const totalLatencies = latencies.length;
      const averageLatency = latencies.reduce((a, b) => a + b, 0) / totalLatencies;
      const sortedLatencies = latencies.slice().sort((a, b) => a - b);
      const medianLatency = sortedLatencies[Math.floor(totalLatencies / 2)] || 0;
      const p95Latency = sortedLatencies[Math.floor(totalLatencies * 0.95)] || 0;
      const p99Latency = sortedLatencies[Math.floor(totalLatencies * 0.99)] || 0;

      logger.log("=== Benchmark Results ===");
      logger.log(`Total requests sent: ${String(totalRequestsSent)}`);
      logger.log(`Total responses received: ${String(totalResponsesReceived)}`);
      logger.log(`Total time (s): ${totalTime.toFixed(2)}`);
      logger.log(`Throughput (requests/second): ${throughput.toFixed(2)}`);
      logger.log(`Average latency (ms): ${averageLatency.toFixed(2)}`);
      logger.log(`Median latency (ms): ${medianLatency.toFixed(2)}`);
      logger.log(`95th percentile latency (ms): ${p95Latency.toFixed(2)}`);
      logger.log(`99th percentile latency (ms): ${p99Latency.toFixed(2)}`);

      const averageMemoryUsage =
        resourceUsageSamples.reduce((sum, sample) => sum + sample.memoryUsage, 0) / resourceUsageSamples.length;
      const averageCpuUsage =
        resourceUsageSamples.reduce((sum, sample) => sum + sample.cpuUsage, 0) / resourceUsageSamples.length;

      logger.log(`Average memory usage (MB): ${averageMemoryUsage.toFixed(2)}`);
      logger.log(`Average CPU usage (% per core): ${(averageCpuUsage * 100).toFixed(2)}`);
      logger.log("Test completed.");
    }, 60000); // Adjusted timeout to 60 seconds
  });
};

runQuantifyStressTest(
  "./packages/microservice/job-broker/tests/input/aralia/xml",
  "/api/quantify/scram",
  1, // Number of times to run each request
);
