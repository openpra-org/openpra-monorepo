import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { MongoClient } from "mongodb";
import mongoose, { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { ExecutableStorageService } from "../../src/executable/services/executable-storage.service";
import { ExecutedResult } from "../../src/executable/schemas/executed-result.schema";
import { InvalidResult } from "../output/executable/invalid-result";
import { ValidExecuteRequest } from "../input/executable/valid-request";

jest.mock("amqplib");

describe("ExecutableStorageService", () => {
  let service: ExecutableStorageService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;
  let client: MongoClient;
  let mongoServer: MongoMemoryServer;
  let executedResultModel: mongoose.Model<ExecutedResult>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(ValidExecuteRequest)) } as ConsumeMessage);
      }),
      ack: jest.fn().mockResolvedValue(undefined),
      nack: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    executedResultModel = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as Model<ExecutedResult>;

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
          useValue: executedResultModel,
        },
      ],
    }).compile();

    service = module.get<ExecutableStorageService>(ExecutableStorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
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

  it("should throw a validation error if input data is invalid", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(InvalidResult as ExecutionResult)) } as ConsumeMessage);
      },
    );

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      "Validation failed: $input.stderr is invalid. Expected string but got undefined",
    );
  });

  it("the database should exist", () => {
    const db = client.db(mongoServer.instanceInfo?.dbName);
    expect(db).toBeDefined();
  });

  it("should log a validation error if saved result does not follow the schema", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(ValidExecuteRequest)) } as ConsumeMessage);
      },
    );

    const validationError = new mongoose.Error.ValidationError(
      new mongoose.Error.ValidatorError({ message: "Invalid field" }),
    );

    const mockExecutedResultInstance = new executedResultModel();
    jest.spyOn(mockExecutedResultInstance, "save").mockRejectedValue(validationError);
    jest.spyOn(executedResultModel, "create").mockReturnValue(mockExecutedResultInstance);

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith("Invalid field");
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-storage side",
    );

    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
