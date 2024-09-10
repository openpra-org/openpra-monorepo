import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../../src/quantification/services/producer.service";
import { ValidQuantifyRequest } from "../input/quantification/valid-request";
import { MissingRequiredKey } from "../input/quantification/invalid-request";

/**
 * End-to-end tests for the ProducerService.
 *
 * These tests cover the following cases:
 *
 * - Should successfully queue a valid quantification request.
 * - Should have the initial queue length equal to the number of messages sent.
 * - Should log an error if environment variables are not set.
 * - Should throw a validation error if input data is invalid.
 * - Should log an error if unable to create a RabbitMQ channel.
 * - Should log an error if unable to create the initial queue.
 * - Should log an error if unable to create the dead letter queue.
 * - Should retry connecting to RabbitMQ broker and throw an error after 3 attempts.
 */

// Mock the RabbitMQ library.
jest.mock("amqplib");

describe("ProducerService", () => {
  let service: ProducerService;
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
      sendToQueue: jest.fn().mockResolvedValue(undefined),
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
        ProducerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
                case "QUANT_JOB_QUEUE_NAME":
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

    service = module.get<ProducerService>(ProducerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clear all mocks after each test.
    jest.clearAllMocks();
  });

  it("should successfully queue a valid quantification request", async () => {
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    await expect(service.createAndQueueQuant(ValidQuantifyRequest)).resolves.toBeUndefined();

    expect(mockChannel.assertExchange).toHaveBeenCalled();
    expect(mockChannel.assertQueue).toHaveBeenCalled();
    expect(mockChannel.bindQueue).toHaveBeenCalled();
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      configService.get("QUANT_JOB_QUEUE_NAME"),
      expect.any(Buffer),
      {
        persistent: true,
      },
    );
  });

  it("should have the initial queue length equal to the number of messages sent", async () => {
    const mockQueueState = { messageCount: 0 };

    (mockChannel.assertQueue as jest.Mock).mockImplementation((queueName) => {
      if (queueName === configService.get("QUANT_JOB_QUEUE_NAME")) {
        return Promise.resolve(mockQueueState);
      }
      return Promise.resolve(undefined);
    });

    (mockChannel.sendToQueue as jest.Mock).mockImplementation((queueName) => {
      if (queueName === configService.get("QUANT_JOB_QUEUE_NAME")) {
        mockQueueState.messageCount++;
      }
    });

    for (let i = 0; i < 5; i++) {
      await service.createAndQueueQuant(ValidQuantifyRequest);
    }

    expect(mockQueueState.messageCount).toBe(5);
  });

  it("should log an error if environment variables are not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await service.createAndQueueQuant(ValidQuantifyRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      "Required environment variables for quantification producer service are not set",
    );
  });

  it("should throw a validation error if input data is invalid", async () => {
    await service.createAndQueueQuant(MissingRequiredKey as QuantifyRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertStringify(): invalid type on $input.models, expect to be Array<string>"),
    );
  });

  it("should log an error if unable to create a RabbitMQ channel", async () => {
    (mockConnection.createChannel as jest.Mock).mockRejectedValue(new Error("Channel creation failed"));

    await service.createAndQueueQuant(ValidQuantifyRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(new Error("Channel creation failed"));
  });

  it("should log an error if unable to create the initial queue", async () => {
    (mockChannel.assertQueue as jest.Mock).mockRejectedValue(new Error("Queue creation failed"));

    await service.createAndQueueQuant(ValidQuantifyRequest);

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

    await service.createAndQueueQuant(ValidQuantifyRequest);

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(new Error("Dead letter queue creation failed"));
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));
    await service.createAndQueueQuant(ValidQuantifyRequest);
    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
