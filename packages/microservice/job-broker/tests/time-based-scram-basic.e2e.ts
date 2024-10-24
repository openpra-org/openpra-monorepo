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

const runQuantifyStressTest = (
  rootDir: string,
  endpoint: string,
  durationInSeconds: number,
  maxConcurrency: number,
): void => {
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
    let app: INestApplication<Server>;
    let logger: Logger;

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

      app = module.createNestApplication();
      logger = new Logger("StressTest");
      app.useLogger(logger);
      await app.init();
      await app.listen(0); // Listen on a random available port
    });

    afterAll(async () => {
      await app.close();
      const connection = app.get<mongoose.Connection>(mongoose.Connection);
      await connection.dropDatabase();
    });

    it(
      "should process requests and collect metrics",
      async () => {
        const latencies: number[] = [];
        let totalRequestsSent = 0;
        let totalResponsesReceived = 0;

        const resourceUsageSamples: {
          timestamp: number;
          cpuUsage: number;
          memoryUsage: number;
        }[] = [];

        const testStartTime = performance.now();
        let lastCpuUsage = process.cpuUsage();

        // Resource usage collection
        const resourceUsageInterval = setInterval(() => {
          const timestamp = performance.now();
          const currentCpuUsage = process.cpuUsage();

          // Calculate the difference in CPU usage since last sample
          const cpuUsageDiff = {
            user: currentCpuUsage.user - lastCpuUsage.user,
            system: currentCpuUsage.system - lastCpuUsage.system,
          };
          lastCpuUsage = currentCpuUsage;

          // Calculate CPU usage percentage normalized per CPU core
          const cpuUsagePercent = (cpuUsageDiff.user + cpuUsageDiff.system) / 1000 / (os.cpus().length * 1000); // Convert microseconds to milliseconds and normalize

          // Get memory usage in MB
          const memoryUsage = process.memoryUsage().rss / 1024 / 1024;

          // Store the resource usage sample
          resourceUsageSamples.push({
            timestamp,
            cpuUsage: cpuUsagePercent,
            memoryUsage,
          });
        }, 1000); // Sample every 1000 milliseconds

        // Calculate the end time of the test
        const endTime = Date.now() + durationInSeconds * 1000;
        let requestNumber = 0;

        // Task generator function
        const taskGenerator = async (): Promise<void> => {
          if (Date.now() >= endTime) {
            return;
          }
          requestNumber++;
          const currentRequestNumber = requestNumber;
          // Randomly select a quantify request
          const quantifyRequest = quantifyRequests[Math.floor(Math.random() * quantifyRequests.length)];

          const sendTime = performance.now();
          try {
            totalRequestsSent++;
            const response = await request(app.getHttpServer())
              .post(endpoint)
              .send(quantifyRequest)
              .set("Content-Type", "application/json")
              .set("Accept", "application/json");
            const receiveTime = performance.now();
            const latency = receiveTime - sendTime;
            latencies.push(latency);
            totalResponsesReceived++;
            expect(response.status).toBe(201);
            logger.log(`Request ${String(currentRequestNumber)} completed successfully.`);
          } catch (error) {
            const receiveTime = performance.now();
            const latency = receiveTime - sendTime;
            latencies.push(latency);
            totalResponsesReceived++;
            logger.error(`Request ${String(currentRequestNumber)} failed.`);
            logger.error("Request failed:", error);
          }
        };

        // Function to run tasks until the test duration is over
        const runTasksUntilTimeUp = async (
          taskGeneratorFn: () => Promise<void>,
          concurrencyLimit: number,
        ): Promise<void> => {
          const executing: Promise<void>[] = [];

          const launchTask = async () => {
            if (Date.now() >= endTime) {
              return;
            }
            const taskPromise = taskGeneratorFn();
            executing.push(taskPromise);
            taskPromise.finally(() => {
              // Remove the completed task from executing array
              const index = executing.indexOf(taskPromise);
              if (index !== -1) {
                executing.splice(index, 1);
              }
              // Launch a new task if time is not up
              if (Date.now() < endTime) {
                void launchTask();
              }
            });
          };

          // Start initial tasks up to concurrency limit
          for (let i = 0; i < concurrencyLimit; i++) {
            void launchTask();
          }

          // Wait until all tasks have completed after time is up
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (executing.length === 0 && Date.now() >= endTime) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
        };

        // Start running tasks
        await runTasksUntilTimeUp(taskGenerator, maxConcurrency);

        // Stop resource usage sampling
        clearInterval(resourceUsageInterval);

        // Calculate test duration
        const testEndTime = performance.now();
        const totalTime = (testEndTime - testStartTime) / 1000; // Convert milliseconds to seconds

        // Calculate throughput
        const throughput = totalResponsesReceived / totalTime;

        // Calculate latency statistics
        const totalLatencies = latencies.length;
        const averageLatency = latencies.reduce((a, b) => a + b, 0) / totalLatencies;
        const sortedLatencies = latencies.slice().sort((a, b) => a - b);
        const medianLatency = sortedLatencies[Math.floor(totalLatencies / 2)] || 0;
        const p95Latency = sortedLatencies[Math.floor(totalLatencies * 0.95)] || 0;
        const p99Latency = sortedLatencies[Math.floor(totalLatencies * 0.99)] || 0;

        // Output metrics
        logger.log("=== Benchmark Results ===");
        logger.log(`Total requests sent: ${String(totalRequestsSent)}`);
        logger.log(`Total responses received: ${String(totalResponsesReceived)}`);
        logger.log(`Total time (s): ${totalTime.toFixed(2)}`);
        logger.log(`Throughput (requests/second): ${throughput.toFixed(2)}`);
        logger.log(`Average latency (ms): ${averageLatency.toFixed(2)}`);
        logger.log(`Median latency (ms): ${medianLatency.toFixed(2)}`);
        logger.log(`95th percentile latency (ms): ${p95Latency.toFixed(2)}`);
        logger.log(`99th percentile latency (ms): ${p99Latency.toFixed(2)}`);

        // Process resource usage samples
        const averageMemoryUsage =
          resourceUsageSamples.reduce((sum, sample) => sum + sample.memoryUsage, 0) / resourceUsageSamples.length;

        const averageCpuUsage =
          resourceUsageSamples.reduce((sum, sample) => sum + sample.cpuUsage, 0) / resourceUsageSamples.length;

        logger.log(`Average memory usage (MB): ${averageMemoryUsage.toFixed(2)}`);
        logger.log(`Average CPU usage (% per core): ${(averageCpuUsage * 100).toFixed(2)}`);

        logger.log("Test completed.");
      },
      (durationInSeconds + 60) * 1000, // Set timeout to duration + buffer in milliseconds
    );
  });
};

runQuantifyStressTest(
  "./packages/microservice/job-broker/tests/input/aralia/xml",
  "/api/quantify/scram",
  60, // Test duration in seconds (e.g., 1 minute)
  1, // Desired concurrency limit
);
