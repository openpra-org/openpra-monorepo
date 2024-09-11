import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { ConsumerService } from "../../src/quantification/services/consumer.service";
import { ValidQuantifyRequest } from "../input/quantification/valid-request";
import { MissingRequiredKey } from "../input/quantification/invalid-request";
import { InvalidReport } from "../output/quantification/invalid-report";

/**
 * Tests for the ConsumerService.
 *
 * These tests cover the following cases:
 *
 * - should log an error if environment variables are not set
 * - should log an error if consumed message is null
 * - should throw a validation error if input data is invalid
 * - should throw a validation error if output data is invalid
 * - should retry connecting to RabbitMQ broker and throw an error after 3 attempts
 */

// Mock the RabbitMQ library.
jest.mock("amqplib");

describe("ConsumerService", () => {
  let service: ConsumerService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;

  beforeEach(async () => {
    // Mock the channel methods of the RabbitMQ library.
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(ValidQuantifyRequest)) } as ConsumeMessage);
      }),
      ack: jest.fn().mockResolvedValue(undefined),
      nack: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the connection method of the RabbitMQ library.
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    // Mock the RabbitMQ connect method.
    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    // Create the testing module.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
                case "QUANT_JOB_QUEUE_NAME":
                  return "some-queue-name";
                case "QUANT_STORAGE_QUEUE_NAME":
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

    service = module.get<ConsumerService>(ConsumerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clear all mocks after each test.
    jest.clearAllMocks();
  });

  it("should log an error if environment variables are not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await service.onModuleInit();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      "Required environment variables for quantification consumer service are not set",
    );
  });

  it("should log an error if consumed message is null", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage(null);
      },
    );

    await service.onModuleInit();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith("Unable to parse message from initial quantification queue");
  });

  it("should throw a validation error if input data is invalid", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(MissingRequiredKey as QuantifyRequest)) } as ConsumeMessage);
      },
    );

    await service.onModuleInit();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertParse(): invalid type on $input.models, expect to be Array<string>"),
    );
  });

  it("should throw a validation error if output data is invalid", async () => {
    jest.spyOn(service, "performQuantification").mockReturnValueOnce(InvalidReport as unknown as QuantifyReport);

    await service.onModuleInit();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertStringify(): invalid type on $input.results, expect to be Array<string>"),
    );
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));

    await expect(service.onModuleInit()).rejects.toThrow(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-consumer side.",
    );

    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
