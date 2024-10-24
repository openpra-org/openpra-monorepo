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
      await app.listen(0);
    });

    afterAll(async () => {
      await app.close();
      const connection = app.get<mongoose.Connection>(mongoose.Connection);
      await connection.dropDatabase();
    });

    it("should process requests and collect metrics", async () => {
      // Array to store the latency of each request in milliseconds.
      const latencies: number[] = [];

      // Total number of requests sent during the test.
      let totalRequestsSent = 0;

      // Total number of responses received during the test.
      let totalResponsesReceived = 0;

      /**
       * Array to store samples of resource usage at different timestamps.
       * Each sample includes:
       * - timestamp: The time when the sample was taken.
       * - cpuUsage: CPU usage percentage normalized per core.
       * - memoryUsage: Memory usage in megabytes.
       */
      const resourceUsageSamples: {
        timestamp: number;
        cpuUsage: number;
        memoryUsage: number;
      }[] = [];

      // The start time of the test, used to calculate total test duration.
      const startTime = performance.now();

      // Resource usage collection
      // Stores the CPU usage at the last sampling interval.
      let lastCpuUsage = process.cpuUsage();

      /**
       * Interval timer that collects resource usage every second.
       * Captures CPU and memory usage and stores them in resourceUsageSamples array.
       */
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

      // Prepare requests
      const requests: Promise<void>[] = [];
      for (const quantifyRequest of quantifyRequests) {
        for (let i = 0; i < numberOfTests; i++) {
          totalRequestsSent++;
          const sendTime = performance.now();
          const reqPromise = request(app.getHttpServer())
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
              logger.log(`Test ${String(totalRequestsSent)} done!`);
            })
            .catch((error: unknown) => {
              const receiveTime = performance.now();
              const latency = receiveTime - sendTime;
              latencies.push(latency);
              totalResponsesReceived++;
              logger.log(`Test ${String(totalRequestsSent)} done but it failed :(`);
              logger.error("Request failed:", error);
            });
          requests.push(reqPromise);
        }
      }

      // Execute all requests concurrently
      await Promise.all(requests);

      // Stop resource usage sampling
      clearInterval(resourceUsageInterval);

      /**
       * The end time of the test, used to calculate total test duration.
       */
      const endTime = performance.now();

      /**
       * Total duration of the test in seconds.
       */
      const totalTime = (endTime - startTime) / 1000; // Convert milliseconds to seconds

      // Calculate throughput
      /**
       * Throughput is calculated as the number of responses received divided by total test duration.
       * Units: requests per second.
       */
      const throughput = totalResponsesReceived / totalTime;

      // Calculate latency statistics
      /**
       * Total number of latency measurements.
       */
      const totalLatencies = latencies.length;

      /**
       * Average latency across all requests.
       * Units: milliseconds.
       */
      const averageLatency = latencies.reduce((a, b) => a + b, 0) / totalLatencies;

      /**
       * Sorted array of latencies, used to calculate median and percentile latencies.
       */
      const sortedLatencies = latencies.slice().sort((a, b) => a - b);

      /**
       * Median latency (50th percentile).
       * Units: milliseconds.
       */
      const medianLatency = sortedLatencies[Math.floor(totalLatencies / 2)] || 0;

      /**
       * 95th percentile latency.
       * Units: milliseconds.
       */
      const p95Latency = sortedLatencies[Math.floor(totalLatencies * 0.95)] || 0;

      // 99th percentile latency.
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
      // Average memory usage across all samples (in MB).
      const averageMemoryUsage =
        resourceUsageSamples.reduce((sum, sample) => sum + sample.memoryUsage, 0) / resourceUsageSamples.length;

      /**
       * Average CPU usage across all samples.
       * Units: percentage per core.
       */
      const averageCpuUsage =
        resourceUsageSamples.reduce((sum, sample) => sum + sample.cpuUsage, 0) / resourceUsageSamples.length;

      logger.log(`Average memory usage (MB): ${averageMemoryUsage.toFixed(2)}`);
      logger.log(`Average CPU usage (% per core): ${(averageCpuUsage * 100).toFixed(2)}`);

      // Scalability observation
      logger.log("Test completed.");
    }, 600000); // Set timeout to 10 minutes
  });
};

runQuantifyStressTest(
  "./packages/microservice/job-broker/tests/input/aralia/xml",
  "/api/quantify/scram",
  1, // Adjust this number based on desired load
);
