import type { Server } from "net";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import request from "supertest";
import { ScramController } from "../../src/quantification/controllers/scram.controller";
import { ProducerService } from "../../src/quantification/services/producer.service";
import { StorageService } from "../../src/quantification/services/storage.service";
import {
  InvalidAdditionalKey,
  InvalidCombination1,
  InvalidCombination2,
  InvalidKeyType,
  MissingRequiredKey,
  MultipleInvalidKeyTypes,
  InvalidLimits1,
  InvalidLimits2,
  InvalidLimits3,
  InvalidLimits4,
  InvalidLimits5,
  InvalidLimits6,
  InvalidLimits7,
  InvalidLimits8,
  InvalidLimits9,
} from "../input/quantification/invalid-request";
import { ValidQuantifyRequest } from "../input/quantification/valid-request";
import { QuantifiedReports } from "../output/quantification/quantified-reports";

/**
 * End-to-end tests for the ScramController.
 *
 * These tests cover the following cases:
 *
 * POST /scram:
 * - Should return 201 Created response when the request body is valid.
 * - Should return 400 Bad Request when a key in the request body has the wrong type.
 * - Should return 400 Bad Request when multiple keys in the request body have the wrong types.
 * - Should return 400 Bad Request when the request body is missing a required key.
 * TODO: Should return 400 Bad Request when the request body contains an additional key.
 * - Should return 400 Bad Request when the request body contains multiple algorithms (bdd, zbdd, and mocus).
 * - Should return 400 Bad Request when the request body contains multiple approximations (rare-event and mcub).
 * - Should return 400 Bad Request when the request body contains invalid limit-order.
 * - Should return 400 Bad Request when the request body contains invalid cut-off.
 * - Should return 400 Bad Request when the request body contains invalid num-trials.
 * - Should return 400 Bad Request when the request body contains invalid num-quantiles.
 * - Should return 400 Bad Request when the request body contains invalid num-bins.
 * - Should return 400 Bad Request when the request body contains invalid seed.
 * - Should return 400 Bad Request when the request body contains invalid mission-time.
 * - Should return 400 Bad Request when the request body contains invalid time-step.
 * - Should return 400 Bad Request when the request body contains invalid verbosity.
 * - Should return 500 Internal Server Error when the service throws an error.
 *
 * GET /scram:
 * - Should return 200 OK response if the service is able to retrieve the list of quantified reports.
 * - Should return 404 Not Found Error when the service is unable to retrieve the list of quantified reports.
 */

describe("ScramController (e2e)", () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ScramController],
      providers: [
        {
          provide: ProducerService,
          useValue: {
            createAndQueueQuant: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getQuantifiedReports: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /scram", () => {
    it("should return 201 Created response when the request body is valid", () => {
      return request(app.getHttpServer()).post("/scram").send(ValidQuantifyRequest).expect(201);
    });

    it("should return 400 Bad Request when a key in the request body has wrong type", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidKeyType).expect(400);
    });

    it("should return 400 Bad Request when multiple keys in the request body have wrong types", () => {
      return request(app.getHttpServer()).post("/scram").send(MultipleInvalidKeyTypes).expect(400);
    });

    it("should return 400 Bad Request when the request body is missing a required key", () => {
      return request(app.getHttpServer()).post("/scram").send(MissingRequiredKey).expect(400);
    });

    /* TODO: This test will be activated later when we implement strict checks for additional object keys
    it("should return 400 Bad Request when the request body contains an additional key", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidAdditionalKey).expect(400);
    });
     */

    /* These 2 tests are only valid for scram-cpp
    it("should return 400 Bad Request when the request body contains mutually exclusive keys (bdd and zbdd)", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidCombination1).expect(400);
    });

    it("should return 400 Bad Request when the request body contains mutually exclusive keys (rare-event and mcub)", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidCombination2).expect(400);
    });
     */

    /* These tests are specifically for scram-node-wrapper
    it("should return 400 Bad Request when the request body contains invalid limit-order", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits1).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid cut-off", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits2).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid num-trials", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits3).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid num-quantiles", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits4).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid num-bins", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits5).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid seed", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits6).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid mission-time", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits7).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid time-step", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits8).expect(400);
    });

    it("should return 400 Bad Request when the request body contains invalid verbosity", () => {
      return request(app.getHttpServer()).post("/scram").send(InvalidLimits9).expect(400);
    });
     */

    it("should return 500 Internal Server Error when the service throws an error", () => {
      const producerService = app.get(ProducerService);
      jest
        .spyOn(producerService, "createAndQueueQuant")
        .mockRejectedValue(new InternalServerErrorException("Some error"));

      return request(app.getHttpServer()).post("/scram").send(ValidQuantifyRequest).expect(500);
    });
  });

  describe("GET /scram", () => {
    it("should return 200 OK response if the service is able to retrieve the list of quantified reports", () => {
      const storageService = app.get(StorageService);
      jest.spyOn(storageService, "getQuantifiedReports").mockResolvedValue(QuantifiedReports);

      return request(app.getHttpServer()).get("/scram").send().expect(200);
    });

    it("should return 404 Not Found Error when the service is unable to retrieve the list of quantified reports", () => {
      const storageService = app.get(StorageService);
      jest.spyOn(storageService, "getQuantifiedReports").mockRejectedValue(new NotFoundException("Some error"));

      return request(app.getHttpServer()).get("/scram").send().expect(404);
    });
  });
});
