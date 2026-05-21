import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { SessionsService } from "../sessions.service";
import { Session } from "../session.schema";

describe("SessionsService", () => {
  let service: SessionsService;
  let model: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    updateOne: jest.Mock;
    find: jest.Mock;
    deleteOne: jest.Mock;
    deleteMany: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue(undefined),
      countDocuments: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      find: jest.fn(),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SessionsService, { provide: getModelToken(Session.name), useValue: model }],
    }).compile();
    service = moduleRef.get(SessionsService);
  });

  it("creates a session row", async () => {
    await service.create({ userId: "u1", jti: "j1", userAgent: "ua", ip: "1.2.3.4", expiresAt: new Date() });
    expect(model.create).toHaveBeenCalledTimes(1);
    const arg = model.create.mock.calls[0][0] as { userId: string; jti: string };
    expect(arg.userId).toBe("u1");
    expect(arg.jti).toBe("j1");
  });

  it("isActive returns false for an undefined jti without querying", async () => {
    expect(await service.isActive(undefined)).toBe(false);
    expect(model.countDocuments).not.toHaveBeenCalled();
  });

  it("isActive reflects whether a session exists", async () => {
    model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
    expect(await service.isActive("j1")).toBe(true);
    model.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    expect(await service.isActive("j1")).toBe(false);
  });

  it("lists sessions with parsed device/browser and a current flag", async () => {
    const docs = [
      { _id: "s1", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Chrome/120 Safari/537", lastSeenAt: new Date(), jti: "j1" },
      { _id: "s2", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17) AppleWebKit Version/17 Safari/604", lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000), jti: "j2" },
    ];
    model.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(docs) }) });

    const out = await service.listForUser("u1", "j1");
    expect(out).toEqual([
      { id: "s1", device: "macOS", browser: "Chrome", lastActive: "Just now", current: true },
      { id: "s2", device: "iOS", browser: "Safari", lastActive: "3 hours ago", current: false },
    ]);
  });

  it("revokeOne deletes by id and user", async () => {
    await service.revokeOne("u1", "s9");
    expect(model.deleteOne).toHaveBeenCalledWith({ _id: "s9", userId: "u1" });
  });

  it("revokeOthers deletes every session except the current jti", async () => {
    await service.revokeOthers("u1", "j1");
    expect(model.deleteMany).toHaveBeenCalledWith({ userId: "u1", jti: { $ne: "j1" } });
  });

  it("revokeByJti deletes the matching session", async () => {
    await service.revokeByJti("j1");
    expect(model.deleteOne).toHaveBeenCalledWith({ jti: "j1" });
  });
});
