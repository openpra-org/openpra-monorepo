import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableService } from "../../src/executable/services/executable.service";
import { ValidExecuteRequest } from "../input/executable/valid-request";
import { MissingRequiredKey } from "../input/executable/invalid-request";

/**
 * End-to-end tests for the ExecutableService.
 *
 * These tests cover the following cases:
 *
 * createAndQueueTask:
 * - Should successfully queue a valid task.
 * - Should have the initial queue length equal to the number of messages sent.
 * - Should log an error if environment variables are not set.
 * - Should throw a validation error if input data is invalid.
 * - Should log an error if unable to create a RabbitMQ channel.
 * - Should log an error if unable to create the initial queue.
 * - Should log an error if unable to create the dead letter queue.
 * TODO: - Should log an error if the message is not queued.
 * - Should retry connecting to RabbitMQ broker and throw an error after 3 attempts.
 */

jest.mock("amqplib");

describe("ExecutableService", () => {
  let service: ExecutableService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;

  beforeEach(async () => {
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutableService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
                case "EXECUTABLE_TASK_QUEUE_NAME":
                  return "some-queue-name";
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

    service = module.get<ExecutableService>(ExecutableService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully queue a valid task", async () => {
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    await expect(service.createAndQueueTask(ValidExecuteRequest)).resolves.toBeUndefined();

    expect(mockChannel.assertExchange).toHaveBeenCalled();
    expect(mockChannel.assertQueue).toHaveBeenCalled();
    expect(mockChannel.bindQueue).toHaveBeenCalled();
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      configService.get("EXECUTABLE_TASK_QUEUE_NAME"),
      expect.any(Buffer),
      {
        persistent: true,
      },
    );
  });

  it("should have the initial queue length equal to the number of messages sent", async () => {
    const mockQueueState = { messageCount: 0 };

    (mockChannel.assertQueue as jest.Mock).mockImplementation((queueName) => {
      if (queueName === configService.get("EXECUTABLE_TASK_QUEUE_NAME")) {
        return Promise.resolve(mockQueueState);
      }
      return Promise.resolve(undefined);
    });

    (mockChannel.sendToQueue as jest.Mock).mockImplementation((queueName) => {
      if (queueName === configService.get("EXECUTABLE_TASK_QUEUE_NAME")) {
        mockQueueState.messageCount++;
      }
    });

    for (let i = 0; i < 5; i++) {
      await service.createAndQueueTask(ValidExecuteRequest);
    }

    expect(mockQueueState.messageCount).toBe(5);
  });

  it("should log an error if environment variables are not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await service.createAndQueueTask(ValidExecuteRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith("Required environment variables for executable service are not set");
  });

  it("should throw a validation error if input data is invalid", async () => {
    await service.createAndQueueTask(MissingRequiredKey as ExecutionTask);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error(
        `Error on typia.json.assertStringify(): invalid type on $input.executable, expect to be ("acube" | "dpc" | "ftrex" | "qrecover" | "saphsolve" | "scram-cli" | "xfta" | "xfta2")`,
      ),
    );
  });

  it("should log an error if unable to create a RabbitMQ channel", async () => {
    (mockConnection.createChannel as jest.Mock).mockRejectedValue(new Error("Channel creation failed"));

    await service.createAndQueueTask(ValidExecuteRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(new Error("Channel creation failed"));
  });

  it("should log an error if unable to create the initial queue", async () => {
    (mockChannel.assertQueue as jest.Mock).mockRejectedValue(new Error("Queue creation failed"));

    await service.createAndQueueTask(ValidExecuteRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(new Error("Queue creation failed"));
  });

  it("should log an error if unable to create the dead letter queue", async () => {
    (mockChannel.assertQueue as jest.Mock).mockImplementationOnce((queueName) => {
      if (queueName === configService.get("DEAD_LETTER_QUEUE_NAME")) {
        return Promise.reject(new Error("Dead letter queue creation failed"));
      }
      return Promise.resolve(undefined);
    });

    await service.createAndQueueTask(ValidExecuteRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(new Error("Dead letter queue creation failed"));
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));
    await service.createAndQueueTask(ValidExecuteRequest);
    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
