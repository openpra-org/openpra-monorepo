import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableWorkerService } from "../../src/executable/services/executable-worker.service";
import { ValidExecuteRequest } from "../input/executable/valid-request";
import { MissingRequiredKey } from "../input/executable/invalid-request";
import { InvalidResult } from "../output/executable/invalid-result";

/**
 * End-to-end tests for the ExecutableWorkerService.
 *
 * These tests cover the following cases:
 *
 * - Should log an error if environment variables are not set.
 * - Should log an error if consumed message is null.
 * - Should throw a validation error if input data is invalid.
 * - Should throw a validation error if output data is invalid.
 * - Should retry connecting to RabbitMQ broker and throw an error after 3 attempts.
 */

// Mock the RabbitMQ library.
jest.mock("amqplib");

describe("ExecutableWorkerService", () => {
  let service: ExecutableWorkerService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;

  beforeEach(async () => {
    // Mock the RabbitMQ channel methods.
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

    // Mock the RabbitMQ connection method.
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    // Mock the RabbitMQ connect method.
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    // Create the testing module.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutableWorkerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
                case "EXECUTABLE_TASK_QUEUE_NAME":
                  return "some-queue-name";
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
      ],
    }).compile();

    service = module.get<ExecutableWorkerService>(ExecutableWorkerService);
    configService = module.get<ConfigService>(ConfigService);
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
      "Required environment variables for executable worker service are not set",
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
    expect(loggerSpyError).toHaveBeenCalledWith("Executable worker service is unable to parse the consumed message.");
  });

  it("should throw a validation error if input data is invalid", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(MissingRequiredKey as ExecutionTask)) } as ConsumeMessage);
      },
    );

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error(
        `Error on typia.json.assertParse(): invalid type on $input.executable, expect to be ("acube" | "dpc" | "ftrex" | "qrecover" | "saphsolve" | "scram-cli" | "xfta" | "xfta2")`,
      ),
    );
  });

  it("should throw a validation error if output data is invalid", async () => {
    jest.spyOn(service, "executeCommand").mockReturnValueOnce(InvalidResult as unknown as ExecutionResult);

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertStringify(): invalid type on $input.stderr, expect to be string"),
    );
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-worker side.",
    );

    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
