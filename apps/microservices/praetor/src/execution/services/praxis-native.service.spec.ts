import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runPraxisWithWorker } from "../workers/praxis-worker-runner";
import { PraxisNativeService } from "./praxis-native.service";

vi.mock("../workers/praxis-worker-runner", () => ({
  runPraxisWithWorker: vi.fn(),
}));

describe("PraxisNativeService", () => {
  const worker = vi.mocked(runPraxisWithWorker);
  let service: PraxisNativeService;

  beforeEach(() => {
    worker.mockReset();
    service = new PraxisNativeService();
  });

  it.each(["validate", "execute"] as const)("returns the parsed %s worker response", async (operation) => {
    worker.mockResolvedValue({ resultJson: '{"schemaVersion":"1.0.0","result":{"ok":true}}', workerThreadId: 3 });

    await expect(service.run(operation, { schemaVersion: "1.0.0" })).resolves.toEqual({
      schemaVersion: "1.0.0",
      result: { ok: true },
    });
    expect(worker).toHaveBeenCalledWith({
      operation,
      requestJson: '{"schemaVersion":"1.0.0"}',
    });
  });

  it("rejects a missing request body before starting a worker", async () => {
    await expect(service.run("execute", undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(worker).not.toHaveBeenCalled();
  });

  it("maps worker failures to an internal API error", async () => {
    worker.mockRejectedValue(new Error("native load failed"));

    await expect(service.run("execute", {})).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      message: "PRAXIS worker execution failed: native load failed",
    });
  });

  it.each(["not json", "[]", "null"])("rejects invalid worker JSON %s", async (resultJson) => {
    worker.mockResolvedValue({ resultJson, workerThreadId: 2 });

    await expect(service.run("validate", {})).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
