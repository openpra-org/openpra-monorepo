import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import request from "supertest";
import { ExecutableController } from "../../src/executable/executable.controller";
import { ExecutableService } from "../../src/executable/services/executable.service";
import { ExecutableStorageService } from "../../src/executable/services/executable-storage.service";
import {
  InvalidAdditionalKey,
  InvalidKeyType,
  MissingRequiredKey,
  MultipleInvalidKeyTypes,
} from "../input/executable/invalid-request";
import { ValidExecuteRequest } from "../input/executable/valid-request";
import { ExecutedResults } from "../output/executable/executed-results";

/**
 * End-to-end tests for the ExecutableController.
 *
 * These tests cover the following cases:
 *
 * POST /tasks:
 * - Should return 201 Created response when the request body is valid.
 * - Should return 400 Bad Request when a key in the request body has the wrong type.
 * - Should return 400 Bad Request when multiple keys in the request body have the wrong types.
 * - Should return 400 Bad Request when the request body is missing a required key.
 * - Should return 400 Bad Request when the request body contains an additional key.
 * - Should return 500 Internal Server Error when the service throws an error.
 *
 * GET /tasks:
 * - Should return 200 OK response if the service is able to retrieve the list of executed tasks.
 * - Should return 404 Not Found Error when the service throws an error.
 */

describe("ExecutableController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Create the testing module.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExecutableController],
      providers: [
        {
          provide: ExecutableService,
          useValue: {
            createAndQueueTask: jest.fn(),
          },
        },
        {
          provide: ExecutableStorageService,
          useValue: {
            getExecutedTasks: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    // Close the application after each test.
    await app.close();
  });

  describe("POST /tasks", () => {
    it("should return 201 Created response when the request body is valid", () => {
      return request(app.getHttpServer()).post("/tasks").send(ValidExecuteRequest).expect(201);
    });

    it("should return 400 Bad Request when a key in the request body has wrong type", () => {
      return request(app.getHttpServer()).post("/tasks").send(InvalidKeyType).expect(400);
    });

    it("should return 400 Bad Request when multiple keys in the request body have wrong types", () => {
      return request(app.getHttpServer()).post("/tasks").send(MultipleInvalidKeyTypes).expect(400);
    });

    it("should return 400 Bad Request when the request body is missing a required key", () => {
      return request(app.getHttpServer()).post("/tasks").send(MissingRequiredKey).expect(400);
    });

    it("should return 400 Bad Request when the request body contains an additional key", () => {
      return request(app.getHttpServer()).post("/tasks").send(InvalidAdditionalKey).expect(400);
    });

    it("should return 500 Internal Server Error when the service throws an error", () => {
      const executableService = app.get(ExecutableService);
      jest
        .spyOn(executableService, "createAndQueueTask")
        .mockRejectedValue(new InternalServerErrorException("Some error"));

      return request(app.getHttpServer()).post("/tasks").send(ValidExecuteRequest).expect(500);
    });
  });

  describe("GET /tasks", () => {
    it("should return 200 OK response if the service is able to retrieve the list of executed tasks", () => {
      const executableStorageService = app.get(ExecutableStorageService);
      jest.spyOn(executableStorageService, "getExecutedTasks").mockResolvedValue(ExecutedResults);

      return request(app.getHttpServer()).get("/tasks").send().expect(200);
    });

    it("should return 404 Not Found Error when the service throws an error", () => {
      const executableStorageService = app.get(ExecutableStorageService);
      jest.spyOn(executableStorageService, "getExecutedTasks").mockRejectedValue(new NotFoundException("Some error"));

      return request(app.getHttpServer()).get("/tasks").send().expect(404);
    });
  });
});
