import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { TeamsService } from "../teams.service";
import { Team } from "../team.schema";

function makeTeamDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  return {
    _id: new Types.ObjectId().toHexString(),
    name: "Risk & Reliability Research Group",
    organization: "NC State",
    description: "PRA collaboration group",
    visibility: "public",
    adminUsername: "ada",
    members: ["ada"],
    pending: [],
    save,
    ...overrides,
  };
}

describe("TeamsService", () => {
  let service: TeamsService;
  let teamModelMock: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    teamModelMock = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getModelToken(Team.name), useValue: teamModelMock },
      ],
    }).compile();
    service = moduleRef.get(TeamsService);
  });

  describe("createTeam", () => {
    it("seeds the creator as admin + sole member, then returns a DTO with role=admin", async () => {
      teamModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeTeamDoc({ ...data })),
      );
      const out = await service.createTeam(
        { name: "New Team", organization: "OpenPRA", description: "", visibility: "private" },
        "ada",
      );
      const arg = teamModelMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.adminUsername).toBe("ada");
      expect(arg.members).toEqual(["ada"]);
      expect(arg.pending).toEqual([]);
      expect(out.role).toBe("admin");
      expect(out.memberCount).toBe(1);
    });
  });

  describe("getMyTeams", () => {
    it("returns teams where the user is admin / member / pending", async () => {
      const a = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      const b = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      const c = makeTeamDoc({ adminUsername: "chen", members: ["chen"], pending: ["ada"], visibility: "private" });
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: jest.fn().mockResolvedValue([a, b, c]) }) });
      const out = await service.getMyTeams("ada");
      expect(out.teams.map((t) => t.role)).toEqual(["admin", "member", "pending"]);
    });
  });

  describe("getAvailableTeams", () => {
    it("filters out teams the user already belongs to and applies a case-insensitive name match", async () => {
      const sortExec = jest.fn().mockResolvedValue([]);
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: sortExec }) });
      await service.getAvailableTeams("ada", "Seismic");
      const filter = teamModelMock.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter["adminUsername"]).toEqual({ $ne: "ada" });
      expect(filter["members"]).toEqual({ $ne: "ada" });
      expect(filter["pending"]).toEqual({ $ne: "ada" });
      const orClauses = filter["$or"] as { name?: RegExp; organization?: RegExp; description?: RegExp }[];
      expect(orClauses).toHaveLength(3);
      expect(orClauses[0].name?.test("seismic study")).toBe(true);
    });

    it("omits the text filter when query is empty", async () => {
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: jest.fn().mockResolvedValue([]) }) });
      await service.getAvailableTeams("ada", "   ");
      const filter = teamModelMock.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter["$or"]).toBeUndefined();
    });
  });

  describe("joinTeam", () => {
    it("adds the user to members for a public team", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], visibility: "public" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.joinTeam(String(doc._id), "ada");
      expect(doc.members).toContain("ada");
      expect(doc.pending).not.toContain("ada");
      expect(out.role).toBe("member");
    });

    it("adds the user to pending for a private team", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], visibility: "private" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.joinTeam(String(doc._id), "ada");
      expect(doc.pending).toContain("ada");
      expect(out.role).toBe("pending");
    });

    it("throws ConflictException when the user is already a member", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.joinTeam(String(doc._id), "ada")).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFoundException when the id is malformed", async () => {
      await expect(service.joinTeam("not-an-id", "ada")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("leaveTeam", () => {
    it("removes the user from members and persists", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.leaveTeam(String(doc._id), "ada");
      expect(doc.members).toEqual(["chen"]);
      expect((doc.save as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it("removes the user from pending list when they had a pending request", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], pending: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.leaveTeam(String(doc._id), "ada");
      expect(doc.pending).toEqual([]);
    });

    it("throws ForbiddenException when an admin tries to leave their own team", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.leaveTeam(String(doc._id), "ada")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws BadRequestException when the user has no relationship to the team", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.leaveTeam(String(doc._id), "ada")).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
