import { BadRequestException } from "@nestjs/common";
import { FaultTreeValidateResultSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SY_ANALYSIS } from "../../example-workbooks/seeds/sy-seed";
import { SyWorkbooksService } from "../sy-workbooks.service";

function serviceFixture(): {
  service: SyWorkbooksService;
  resolveAccess: jest.Mock;
} {
  const document = {
    workbookId: "sy-workbook",
    projectId: "project-1",
    ownerUsername: "owner",
    revision: 7,
    mef: structuredClone(SY_ANALYSIS),
  };
  const syWorkbookModel = {
    findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(document) })),
  };
  const resolveAccess = jest.fn().mockResolvedValue({ role: "viewer" });
  const service = new SyWorkbooksService(
    syWorkbookModel as never,
    {} as never,
    { resolveAccess } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, resolveAccess };
}

describe("SY fault-tree validation", () => {
  it("returns the versioned server-authoritative analysis-ready result", async () => {
    const { service, resolveAccess } = serviceFixture();
    const models = SY_ANALYSIS.systemLogicModels.filter(
      ({ nonDetailedModelJustification }) => nonDetailedModelJustification === undefined,
    );
    expect(models.length).toBeGreaterThan(0);

    for (const model of models) {
      const result = await service.validateFaultTree(
        "sy-workbook",
        model.uuid,
        {
          schemaVersion: "1.0.0",
          modelId: model.uuid,
          workbookRevision: 7,
          mode: "ANALYSIS_READY",
        },
        { username: "reviewer" },
      );

      expect(FaultTreeValidateResultSchema.safeParse(result).success).toBe(true);
      expect(result.validation.owner).toEqual({
        workbookId: "sy-workbook",
        modelId: model.uuid,
        workbookRevision: 7,
      });
      expect(result.validation.mode).toBe("ANALYSIS_READY");
      expect(result.validation.issues.filter(({ severity }) => severity === "ERROR")).toEqual([]);
    }
    expect(resolveAccess).toHaveBeenCalledWith("project-1", { username: "reviewer" });
  });

  it("rejects route/body model mismatches and system-level representations", async () => {
    const { service } = serviceFixture();
    const detailed = SY_ANALYSIS.systemLogicModels.find(
      ({ nonDetailedModelJustification }) => nonDetailedModelJustification === undefined,
    )!;
    const systemLevel = SY_ANALYSIS.systemLogicModels.find(
      ({ nonDetailedModelJustification }) => nonDetailedModelJustification !== undefined,
    )!;

    await expect(service.validateFaultTree(
      "sy-workbook",
      "different-model",
      {
        schemaVersion: "1.0.0",
        modelId: detailed.uuid,
        workbookRevision: 7,
        mode: "DRAFT",
      },
      { username: "reviewer" },
    )).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.validateFaultTree(
      "sy-workbook",
      systemLevel.uuid,
      {
        schemaVersion: "1.0.0",
        modelId: systemLevel.uuid,
        workbookRevision: 7,
        mode: "DRAFT",
      },
      { username: "reviewer" },
    )).rejects.toThrow("System-level models cannot be validated as decomposed fault trees");
  });
});
