import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getModelToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Model } from "mongoose";
import { StorageService } from "../../src/quantification/services/storage.service";
import { QuantifiedReport, QuantifiedReportDocument } from "../../src/quantification/schemas/quantified-report.schema";
import { InvalidReport } from "../output/quantification/invalid-report";
import { QuantifiedReport1, QuantifiedReports } from "../output/quantification/quantified-reports";

jest.mock("amqplib");

describe("StorageService", () => {
  let service: StorageService;
  let configService: ConfigService;
  const loggerSpyError = jest.spyOn(Logger.prototype, "error");
  let mockConnection: Partial<amqp.Connection>;
  let mockChannel: Partial<amqp.Channel>;
  let client: MongoClient;
  let mongoServer: MongoMemoryServer;
  let mockQuantifiedReportModel: Model<QuantifiedReportDocument>;

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
        onMessage({ content: Buffer.from(JSON.stringify(QuantifiedReport1)) } as ConsumeMessage);
      }),
      ack: jest.fn().mockResolvedValue(undefined),
      nack: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "RABBITMQ_URL":
                  return "some-rabbitmq-url";
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
        {
          provide: getModelToken(QuantifiedReport.name),
          useValue: Model,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
    mockQuantifiedReportModel = module.get<Model<QuantifiedReportDocument>>(getModelToken(QuantifiedReport.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log an error if environment variables are not set", async () => {
    jest.spyOn(configService, "get").mockReturnValueOnce(undefined);

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      "Required environment variables for quantification storage service are not set",
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
    expect(loggerSpyError).toHaveBeenCalledWith("Unable to parse message from quantification storage queue");
  });

  it("should throw a validation error if consumed data is invalid", async () => {
    (mockChannel.consume as jest.Mock).mockImplementation(
      (queue: string, onMessage: (msg: ConsumeMessage | null) => void) => {
        onMessage({ content: Buffer.from(JSON.stringify(InvalidReport)) } as ConsumeMessage);
      },
    );

    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
    expect(loggerSpyError).toHaveBeenCalledWith(
      new Error("Error on typia.json.assertParse(): invalid type on $input.results, expect to be Array<string>"),
    );
  });

  it("should connect to MongoDB server", async () => {
    const db = client.db("QuantifiedReport");
    const collections = await db.collections();
    expect(collections).toBeDefined();
  });

  it("should return the quantified reports", async () => {
    const spy = jest.spyOn(mockQuantifiedReportModel, "find").mockResolvedValue(QuantifiedReports);

    const results = await service.getQuantifiedReports();
    expect(spy).toHaveBeenCalled();
    expect(results).toEqual(QuantifiedReports);
  });

  it("should save a valid report", async () => {
    const saveSpy = jest.spyOn(mockQuantifiedReportModel, "create");
    await service.onApplicationBootstrap();

    expect(saveSpy).toHaveBeenCalled();
  });

  it("should throw error if the saved report is invalid", async () => {
    const validationErrors = [new mongoose.Error.ValidationError()];

    validationErrors[0].errors.results = new mongoose.Error.ValidatorError({
      message: "should be Array<string>, not string",
    });

    (mockQuantifiedReportModel.create as jest.Mock).mockRejectedValue(validationErrors);
    await service.onApplicationBootstrap();

    expect(loggerSpyError).toHaveBeenCalledTimes(1);
  });

  it("should retry connecting to RabbitMQ broker and throw an error after 3 attempts", async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error("Connection failed"));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-storage-service side",
    );

    expect(amqp.connect).toHaveBeenCalledTimes(3);
  }, 45000);
});
