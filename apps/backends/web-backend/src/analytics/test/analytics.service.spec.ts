import { Types } from "mongoose";
import { AnalyticsService } from "../analytics.service";

describe("AnalyticsService", () => {
  it("accepts only supported client events and enriches them from workbook data", async () => {
    const workbookId = new Types.ObjectId();
    const projectId = new Types.ObjectId();
    const insertMany = jest.fn().mockResolvedValue([]);
    const eventModel = { insertMany };
    const workbookModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: workbookId, projectId: String(projectId), elementCode: "POS" }]) }),
    };
    const projectModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: projectId, mode: "internal-events" }]) }),
    };
    const posWorkbookModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{
        projectId: String(projectId),
        mef: { metadata: { plantIdentity: { reactorType: "PWR" } } },
      }]) }),
    };
    const service = new AnalyticsService(
      eventModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      projectModel as never,
      workbookModel as never,
      posWorkbookModel as never,
      {} as never,
    );

    const result = await service.ingest([
      { type: "feature_used", workbookId: String(workbookId), sessionId: "session-a", feature: "button:save" },
      { type: "element_time", workbookId: String(workbookId), sessionId: "session-a", technicalElement: "POS", activeMs: 12_000, idleMs: 4_000 },
      { type: "feature_used", feature: "" },
    ], { userId: "user-id", username: "ada" });

    expect(result).toEqual({ accepted: 2 });
    expect(insertMany).toHaveBeenCalledTimes(1);
    const inserted = insertMany.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(inserted[0]).toEqual(expect.objectContaining({
      username: "ada",
      technicalElement: "POS",
      projectType: "internal-events",
      reactorType: "PWR",
      feature: "button:save",
    }));
    expect(inserted[1]).toEqual(expect.objectContaining({ activeMs: 12_000, idleMs: 4_000 }));
  });

  it("counts a campaign visitor as unique only when the visit is first inserted", async () => {
    const campaignId = new Types.ObjectId();
    const eventModel = { create: jest.fn().mockResolvedValue({}) };
    const campaignModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({
        _id: campaignId,
        active: true,
        expiresAt: null,
        name: "Investor preview",
        destinationPath: "/auth?signup=1",
        token: "campaign-token",
      }) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const visitModel = {
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ upsertedCount: 1 }) }),
    };
    const service = new AnalyticsService(
      eventModel as never,
      {} as never,
      campaignModel as never,
      visitModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.openCampaign("campaign-token", "visitor-1")).resolves.toEqual({
      name: "Investor preview",
      destinationPath: "/auth?signup=1",
      token: "campaign-token",
    });
    expect(campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: campaignId },
      {
        $inc: { openCount: 1, uniqueOpenCount: 1 },
        $set: { lastOpenedAt: expect.any(Date) },
      },
    );
  });
});
