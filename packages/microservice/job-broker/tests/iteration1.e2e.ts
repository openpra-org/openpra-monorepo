import { Server } from "net";
import { performance } from "perf_hooks";
import * as fs from "fs";
import { INestApplication, INestMicroservice, Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongooseModule } from "@nestjs/mongoose";
import { QuantificationConsumerModule } from "../src/quantification/quantification-consumer.module";
import { ScramController } from "../src/quantification/controllers/scram.controller";
import { ProducerService } from "../src/quantification/services/producer.service";
import { StorageService } from "../src/quantification/services/storage.service";
import { ConsumerService } from "../src/quantification/services/consumer.service";
import { EnvVarKeys } from "../config/env_vars.config";
import { JobBrokerTestModule } from "../src/job-broker-test.module";

describe("Microservice Benchmark Test", () => {
  let app: INestApplication<Server>;
  const consumers: INestMicroservice[] = [];
  const numConsumers = 10; // Adjust this number as needed (maximum 128)

  let scramController: ScramController;
  let producerService: ProducerService;
  let storageService: StorageService;
  let mongod: MongoMemoryServer;

  const consumerServices: ConsumerService[] = [];

  const logger = new Logger("BenchmarkTest");

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();

    // Create the producer+storage application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoUri), JobBrokerTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(logger);
    await app.init();
    await app.listen(0);

    // Get instances of the services to collect metrics later
    scramController = app.get<ScramController>(ScramController);
    producerService = app.get<ProducerService>(ProducerService);
    storageService = app.get<StorageService>(StorageService);

    // Create consumer applications (up to 128 instances)
    for (let i = 0; i < numConsumers; i++) {
      const consumerApp = await NestFactory.createMicroservice<MicroserviceOptions>(QuantificationConsumerModule, {
        transport: Transport.RMQ,
        options: {
          urls: [EnvVarKeys.RABBITMQ_URL],
        },
      });

      const consumerService = consumerApp.get<ConsumerService>(ConsumerService);
      consumerServices.push(consumerService);

      await consumerApp.listen();
      consumers.push(consumerApp);
    }
  });

  afterAll(async () => {
    // Close the producer+storage application
    await app.close();
    // Close all consumer applications
    for (const consumerApp of consumers) {
      await consumerApp.close();
    }

    await mongod.stop();
  });

  it("should process requests and collect metrics", async () => {
    const numberOfRequests = 100; // Total number of requests to send

    // Arrays to store metrics
    const scramLatencies: number[] = [];
    const scramCpuUsages: number[] = [];
    const scramMemoryUsages: number[] = [];

    const producerLatencies: number[] = [];
    const producerCpuUsages: number[] = [];
    const producerMemoryUsages: number[] = [];

    const storageLatencies: number[] = [];
    const storageCpuUsages: number[] = [];
    const storageMemoryUsages: number[] = [];

    const consumerLatencies: number[] = [];
    const consumerCpuUsages: number[] = [];
    const consumerMemoryUsages: number[] = [];

    let totalRequestsSent = 0;
    let totalResponsesReceived = 0;

    // Read the sample XML file and encode it in base64
    const xmlFilePath = "./packages/microservice/job-broker/tests/input/aralia/xml/chinese.xml";
    const xmlContent = fs.readFileSync(xmlFilePath, "utf-8");
    const base64Model = Buffer.from(xmlContent, "utf-8").toString("base64");

    // Prepare the QuantifyRequest object
    const quantifyRequest = {
      mocus: true,
      mcub: true,
      probability: true,
      "no-indent": true,
      models: [base64Model],
    };

    const startTime = performance.now();

    // Send requests sequentially (or adjust to send them concurrently)
    for (let i = 0; i < numberOfRequests; i++) {
      totalRequestsSent++;
      try {
        await request(app.getHttpServer())
          .post("/api/quantify/scram")
          .send(quantifyRequest)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(201);

        totalResponsesReceived++;
        logger.log(`Request ${String(totalRequestsSent)} processed successfully.`);
      } catch (error) {
        totalResponsesReceived++;
        logger.error(`Request ${String(totalRequestsSent)} failed:`, error);
      }

      // After each request, collect the metrics from the services

      // ScramController metrics
      scramLatencies.push(scramController.getScramLatency());
      scramCpuUsages.push(scramController.getScramCpuUsage());
      scramMemoryUsages.push(scramController.getScramMemoryUsage());

      // ProducerService metrics
      producerLatencies.push(producerService.getQuantifyProducerLatency());
      producerCpuUsages.push(producerService.getQuantifyProducerCpuUsage());
      producerMemoryUsages.push(producerService.getQuantifyProducerMemoryUsage());

      // StorageService metrics
      storageLatencies.push(storageService.getQuantifyStorageLatency());
      storageCpuUsages.push(storageService.getQuantifyStorageCpuUsage());
      storageMemoryUsages.push(storageService.getQuantifyStorageMemoryUsage());

      // ConsumerService metrics
      // Collect metrics from all consumer services
      let totalConsumerLatency = 0;
      let totalConsumerCpuUsage = 0;
      let totalConsumerMemoryUsage = 0;

      for (const consumerService of consumerServices) {
        totalConsumerLatency += consumerService.getQuantifyConsumerLatency();
        totalConsumerCpuUsage += consumerService.getQuantifyConsumerCpuUsage();
        totalConsumerMemoryUsage += consumerService.getQuantifyConsumerMemoryUsage();
      }

      consumerLatencies.push(totalConsumerLatency);
      consumerCpuUsages.push(totalConsumerCpuUsage);
      consumerMemoryUsages.push(totalConsumerMemoryUsage);
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime) / 1000; // Total time in seconds

    // Calculate throughput
    const throughput = numberOfRequests / totalTime;

    // Calculate latency statistics
    function calculateStatistics(data: number[]) {
      const totalData = data.length;
      const average = data.reduce((a, b) => a + b, 0) / totalData;
      const sortedData = data.slice().sort((a, b) => a - b);
      const median = sortedData[Math.floor(totalData / 2)] || 0;
      const p95 = sortedData[Math.floor(totalData * 0.95)] || 0;
      const p99 = sortedData[Math.floor(totalData * 0.99)] || 0;
      return { average, median, p95, p99 };
    }

    // ScramController metrics
    const scramLatencyStats = calculateStatistics(scramLatencies);
    const scramCpuUsageStats = calculateStatistics(scramCpuUsages);
    const scramMemoryUsageStats = calculateStatistics(scramMemoryUsages);

    // ProducerService metrics
    const producerLatencyStats = calculateStatistics(producerLatencies);
    const producerCpuUsageStats = calculateStatistics(producerCpuUsages);
    const producerMemoryUsageStats = calculateStatistics(producerMemoryUsages);

    // StorageService metrics
    const storageLatencyStats = calculateStatistics(storageLatencies);
    const storageCpuUsageStats = calculateStatistics(storageCpuUsages);
    const storageMemoryUsageStats = calculateStatistics(storageMemoryUsages);

    // ConsumerService metrics
    const consumerLatencyStats = calculateStatistics(consumerLatencies);
    const consumerCpuUsageStats = calculateStatistics(consumerCpuUsages);
    const consumerMemoryUsageStats = calculateStatistics(consumerMemoryUsages);

    // Output metrics
    logger.log("=== Benchmark Results ===");
    logger.log(`Total requests sent: ${String(totalRequestsSent)}`);
    logger.log(`Total responses received: ${String(totalResponsesReceived)}`);
    logger.log(`Total time (s): ${totalTime.toFixed(2)}`);
    logger.log(`Throughput (requests/second): ${throughput.toFixed(2)}`);

    logger.log("--- ScramController Metrics ---");
    logger.log(`Average Latency: ${scramLatencyStats.average.toFixed(2)} ms`);
    logger.log(`Median Latency: ${scramLatencyStats.median.toFixed(2)} ms`);
    logger.log(`95th Percentile Latency: ${scramLatencyStats.p95.toFixed(2)} ms`);
    logger.log(`99th Percentile Latency: ${scramLatencyStats.p99.toFixed(2)} ms`);
    logger.log(`Average CPU Usage: ${scramCpuUsageStats.average.toFixed(2)} %`);
    logger.log(`Average Memory Usage: ${scramMemoryUsageStats.average.toFixed(2)} MB`);

    logger.log("--- ProducerService Metrics ---");
    logger.log(`Average Latency: ${producerLatencyStats.average.toFixed(2)} ms`);
    logger.log(`Median Latency: ${producerLatencyStats.median.toFixed(2)} ms`);
    logger.log(`95th Percentile Latency: ${producerLatencyStats.p95.toFixed(2)} ms`);
    logger.log(`99th Percentile Latency: ${producerLatencyStats.p99.toFixed(2)} ms`);
    logger.log(`Average CPU Usage: ${producerCpuUsageStats.average.toFixed(2)} %`);
    logger.log(`Average Memory Usage: ${producerMemoryUsageStats.average.toFixed(2)} MB`);

    logger.log("--- StorageService Metrics ---");
    logger.log(`Average Latency: ${storageLatencyStats.average.toFixed(2)} ms`);
    logger.log(`Median Latency: ${storageLatencyStats.median.toFixed(2)} ms`);
    logger.log(`95th Percentile Latency: ${storageLatencyStats.p95.toFixed(2)} ms`);
    logger.log(`99th Percentile Latency: ${storageLatencyStats.p99.toFixed(2)} ms`);
    logger.log(`Average CPU Usage: ${storageCpuUsageStats.average.toFixed(2)} %`);
    logger.log(`Average Memory Usage: ${storageMemoryUsageStats.average.toFixed(2)} MB`);

    logger.log("--- ConsumerService Metrics ---");
    logger.log(`Average Latency: ${consumerLatencyStats.average.toFixed(2)} ms`);
    logger.log(`Median Latency: ${consumerLatencyStats.median.toFixed(2)} ms`);
    logger.log(`95th Percentile Latency: ${consumerLatencyStats.p95.toFixed(2)} ms`);
    logger.log(`99th Percentile Latency: ${consumerLatencyStats.p99.toFixed(2)} ms`);
    logger.log(`Average CPU Usage: ${consumerCpuUsageStats.average.toFixed(2)} %`);
    logger.log(`Average Memory Usage: ${consumerMemoryUsageStats.average.toFixed(2)} MB`);
  }, 600000); // Set timeout to 10 minutes if needed
});
