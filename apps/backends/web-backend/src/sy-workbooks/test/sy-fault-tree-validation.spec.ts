import { BadRequestException } from "@nestjs/common";
import { FaultTreeValidateResultSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SY_ANALYSIS } from "../../example-workbooks/seeds/sy-seed";
import { SyWorkbooksService } from "../sy-workbooks.service";

function serviceFixture(): {
  service: SyWorkbooksService;
  resolveAccess: jest.Mock;
  document: { mef: typeof SY_ANALYSIS; revision: number };
  update: jest.Mock;
} {
  const document = {
    workbookId: "sy-workbook",
    projectId: "project-1",
    ownerUsername: "owner",
    revision: 7,
    updatedAt: new Date(),
    mef: structuredClone(SY_ANALYSIS),
  };
  const update = jest.fn((_filter: unknown, change: { $set: { mef: typeof SY_ANALYSIS; revision: number } }) => ({
    exec: async () => Object.assign(document, change.$set),
  }));
  const syWorkbookModel = {
    findOneAndUpdate: update,
    findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(document) })),
  };
  const resolveAccess = jest.fn().mockResolvedValue({ role: "viewer" });
  const service = new SyWorkbooksService(
    syWorkbookModel as never,
    {} as never,
    { resolveAccess } as never,
    {} as never,
    { resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]) } as never,
    {} as never,
    { requireEdit: jest.fn().mockResolvedValue({ workbookRoles: ["preparer"] }) } as never,
    {} as never,
  );
  return { service, resolveAccess, document, update };
}

describe("SY fault-tree validation", () => {
  const legacyBasis = { kind: "FAILURE_RATE" as const, conversion: "LINEAR" as const,
    failureRate: { value: .001, unit: "HOUR" as const }, missionTime: { value: 100, unit: "HOUR" as const } };

  it("keeps a saved legacy workbook readable and allows explicit review", async () => {
    const { service, document } = serviceFixture();
    document.mef.systemBasicEvents[0]!.quantificationBasis = structuredClone(legacyBasis);
    const read = await service.findOne("sy-workbook", { username: "reviewer" });
    expect(read.mef.systemBasicEvents[0]?.quantificationBasis).toEqual(legacyBasis);
    expect(document.revision).toBe(7);
    await service.patchMef("sy-workbook", { expectedRevision: 7, operations: [
      { op: "replace", path: ["systemBasicEvents", 0, "name"], value: "Review pending" },
    ] }, { username: "reviewer" });
    expect(document.mef.systemBasicEvents[0]?.quantificationBasis).toEqual(legacyBasis);
    const reviewed = await service.patchMef("sy-workbook", { expectedRevision: 8, operations: [
      { op: "replace", path: ["systemBasicEvents", 0, "quantificationBasis", "conversion"], value: "EXPONENTIAL" },
      { op: "replace", path: ["systemBasicEvents", 0, "probability"], value: .09516258196404048 },
    ] }, { username: "reviewer" });
    expect(reviewed.mef.systemBasicEvents[0]?.quantificationBasis).toMatchObject({ conversion: "EXPONENTIAL" });
    expect(reviewed.revision).toBe(9);
  });

  it("rejects new or edited linear settings without writing the workbook", async () => {
    const { service, document, update } = serviceFixture();
    await expect(service.patchMef("sy-workbook", { expectedRevision: 7, operations: [
      { op: "add", path: ["systemBasicEvents", 0, "quantificationBasis"], value: legacyBasis },
    ] }, { username: "reviewer" })).rejects.toThrow("Review the rate and mission time");
    document.mef.systemBasicEvents[0]!.quantificationBasis = structuredClone(legacyBasis);
    await expect(service.patchMef("sy-workbook", { expectedRevision: 7, operations: [
      { op: "replace", path: ["systemBasicEvents", 0, "quantificationBasis", "failureRate", "value"], value: .002 },
    ] }, { username: "reviewer" })).rejects.toThrow("Review the rate and mission time");
    expect(update).not.toHaveBeenCalled();
  });

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
