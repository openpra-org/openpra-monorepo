import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExecuteController } from "./execute.controller";
import { ExecuteProducerService } from "../services/execute-producer.service";
import { ExecuteStorageService } from "../services/execute-storage.service";
import { PraxisNativeService } from "../services/praxis-native.service";

describe("ExecuteController native PRAXIS API", () => {
  let app: INestApplication;
  const nativeService = { run: vi.fn() };

  beforeEach(async () => {
    nativeService.run.mockReset();
    const module = await Test.createTestingModule({
      controllers: [ExecuteController],
      providers: [
        { provide: ExecuteProducerService, useValue: {} },
        { provide: ExecuteStorageService, useValue: {} },
        { provide: PraxisNativeService, useValue: nativeService },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(["validate", "execute"] as const)("exposes POST /praxis/native/%s", async (operation) => {
    nativeService.run.mockResolvedValue({ schemaVersion: "1.0.0", result: { valid: true } });
    const body = { schemaVersion: "1.0.0", request: {}, modelSnapshots: [] };

    const response = await request(app.getHttpServer()).post(`/praxis/native/${operation}`).send(body).expect(200);

    expect(response.body).toEqual({ schemaVersion: "1.0.0", result: { valid: true } });
    expect(nativeService.run).toHaveBeenCalledWith(operation, body);
  });
});
