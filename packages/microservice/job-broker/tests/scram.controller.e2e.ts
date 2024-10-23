import type { Server } from "net";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import request from "supertest";
import { ScramController } from "../src/quantification/controllers/scram.controller";
import { ProducerService } from "../src/quantification/services/producer.service";
import { StorageService } from "../src/quantification/services/storage.service";
import { InvalidKeyType, MissingRequiredKey, MultipleInvalidKeyTypes } from "./input/quantification/invalid-request";
import { ValidQuantifyRequest } from "./input/quantification/valid-request";
import { QuantifiedReports } from "./output/quantification/quantified-reports";

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
