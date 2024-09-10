import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Model } from "mongoose";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { ExecutableStorageService } from "../../src/executable/services/executable-storage.service";
import { InvalidResult } from "../output/executable/invalid-result";
import { ExecutedResult1, ExecutedResults } from "../output/executable/executed-results";
import { ExecutedResult, ExecutedResultDocument } from "../../src/executable/schemas/executed-result.schema";

/**
 * End-to-end tests for the ExecutableStorageService.
 *
 * These tests cover the following cases:
 *
 * - Should log an error if environment variables are not set.
 * - Should log an error if consumed message is null.
 * - Should throw a validation error if consumed data is invalid.
 * - Should connect to MongoDB server.
 * - Should return the executed results.
 * - Should save a valid result.
 * - Should throw error if the saved result is invalid.
 * - Should retry connecting to RabbitMQ broker and throw an error after 3 attempts.
 */

// Mock the RabbitMQ library.
jest.mock("amqplib");

describe("ExecutableStorageService", () => {
  let service: ExecutableStorageService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;
  let client: MongoClient;
  let mongoServer: MongoMemoryServer;
  let mockExecutedResultDocument: Model<ExecutedResultDocument>;

  beforeAll(async () => {
    // Set up an in-memory MongoDB server.
    mongoServer = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    // Close the MongoDB client and stop the in-memory server.
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Mock the RabbitMQ methods.
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(ExecutedResult1)) } as ConsumeMessage);
      }),
      ack: jest.fn().mockResolvedValue(undefined),
      nack: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the RabbitMQ method.
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    // Mock the RabbitMQ connect method.
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    // Create the testing module.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutableStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
                case "EXECUTABLE_STORAGE_QUEUE_NAME":
                  return "some-storage-queue";
                case "DEAD_LETTER_QUEUE_NAME":
                  return "some-dead-letter-queue";
                case "DEAD_LETTER_EXCHANGE_NAME":
                  return "some-dead-letter-exchange";
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: getModelToken(ExecutedResult.name),
          useValue: Model,
        },
      ],
    }).compile();

    service = module.get<ExecutableStorageService>(ExecutableStorageService);
    configService = module.get<ConfigService>(ConfigService);
    mockExecutedResultDocument = module.get<Model<ExecutedResultDocument>>(getModelToken(ExecutedResult.name));
  });

  afterEach(() => {
    // Clear all mocks after each test.
    jest.clearAllMocks();
  });

  it("should log an error if environment variables are not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      "Required environment variables for executable storage service are not set",
    );
  });

  it("should log an error if consumed message is null", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage(null);
      },
    );

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith("Executable storage service is unable to parse the consumed message.");
  });

  it("should throw a validation error if consumed data is invalid", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(InvalidResult as ExecutionResult)) } as ConsumeMessage);
      },
    );

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertParse(): invalid type on $input.stderr, expect to be string"),
    );
  });

  it("should connect to MongoDB server", async () => {
    const db = client.db("ExecutedResult");
    const collections = await db.collections();
    expect(collections).toBeDefined();
  });

  it("should return the executed results", async () => {
    const spy = jest.spyOn(mockExecutedResultDocument, "find").mockResolvedValue(ExecutedResults);

    const results = await service.getExecutedTasks();
    expect(spy).toHaveBeenCalled();
    expect(results).toEqual(ExecutedResults);
  });

  it("should save a valid result", async () => {
    const saveSpy = jest.spyOn(mockExecutedResultDocument, "create");
    await service.onApplicationBootstrap();

    expect(saveSpy).toHaveBeenCalled();
  });

  it("should throw error if the saved result is invalid", async () => {
    const validationErrors = [
      new mongoose.Error.ValidationError(),
      new mongoose.Error.ValidationError(),
      new mongoose.Error.ValidationError(),
    ];

    validationErrors[0].errors.exit = new mongoose.Error.ValidatorError({
      message: "should be between -255 and 255",
    });
    validationErrors[1].errors.stderr = new mongoose.Error.ValidatorError({ message: "stderr cannot be empty" });
    validationErrors[2].errors.field3 = new mongoose.Error.ValidatorError({ message: "stdout cannot be empty" });

    (mockExecutedResultDocument.create as jest.Mock).mockRejectedValue(validationErrors);
    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-storage side",
    );

    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
