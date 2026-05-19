import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { TeamsService } from "../teams.service";
import { Team } from "../team.schema";
import { User } from "../../users/user.schema";

function makeTeamDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  return {
    _id: new Types.ObjectId().toHexString(),
    name: "Risk & Reliability Research Group",
    organization: "NC State",
    description: "PRA collaboration group",
    visibility: "public",
    adminUsername: "ada",
    members: ["ada"],
    invited: [],
    save,
    deleteOne,
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
  let userModelMock: {
    findOne: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    teamModelMock = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };
    userModelMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getModelToken(Team.name), useValue: teamModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
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
      expect(arg.invited).toEqual([]);
      expect(out.role).toBe("admin");
      expect(out.memberCount).toBe(1);
    });
  });

  describe("getMyTeams", () => {
    it("returns teams where the user is admin or member", async () => {
      const a = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      const b = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: jest.fn().mockResolvedValue([a, b]) }) });
      const out = await service.getMyTeams("ada");
      expect(out.teams.map((t) => t.role)).toEqual(["admin", "member"]);
    });
  });

  describe("getMyInvitations", () => {
    it("returns teams where the user is in invited[] with role='invited'", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], invited: ["ada"], visibility: "private" });
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: jest.fn().mockResolvedValue([doc]) }) });
      const out = await service.getMyInvitations("ada");
      expect(out.teams).toHaveLength(1);
      expect(out.teams[0].role).toBe("invited");
    });
  });

  describe("getAvailableTeams", () => {
    it("filters to public teams the user does not belong to, with case-insensitive match", async () => {
      const sortExec = jest.fn().mockResolvedValue([]);
      teamModelMock.find.mockReturnValue({ sort: () => ({ exec: sortExec }) });
      await service.getAvailableTeams("ada", "Seismic");
      const filter = teamModelMock.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter["visibility"]).toBe("public");
      expect(filter["adminUsername"]).toEqual({ $ne: "ada" });
      expect(filter["members"]).toEqual({ $ne: "ada" });
      expect(filter["invited"]).toEqual({ $ne: "ada" });
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

  describe("getTeamDetail", () => {
    it("hides a private team from non-members with 404", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], visibility: "private" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.getTeamDetail(String(doc._id), "ada")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns roster + invited for the admin", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada", "chen"],
        invited: ["carol"],
        visibility: "private",
      });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.find.mockImplementation(() => ({
        lean: () => Promise.resolve([
          { username: "ada", fullName: "Ada Lovelace" },
          { username: "chen", fullName: "M. Chen" },
          { username: "carol", fullName: "Carol R" },
        ]),
      }));
      const out = await service.getTeamDetail(String(doc._id), "ada");
      expect(out.members.map((m) => m.username)).toEqual(["ada", "chen"]);
      expect(out.invited.map((m) => m.username)).toEqual(["carol"]);
    });

    it("returns only the inviting team for the invitee, with members + own invitation only", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada"],
        invited: ["chen", "bob"],
        visibility: "private",
      });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.find.mockImplementation(() => ({
        lean: () => Promise.resolve([
          { username: "ada", fullName: "Ada Lovelace" },
          { username: "chen", fullName: "M. Chen" },
        ]),
      }));
      const out = await service.getTeamDetail(String(doc._id), "chen");
      expect(out.role).toBe("invited");
      expect(out.invited.map((m) => m.username)).toEqual(["chen"]);
    });
  });

  describe("joinTeam", () => {
    it("adds the user to members for a public team", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], visibility: "public" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.joinTeam(String(doc._id), "ada");
      expect(doc.members).toContain("ada");
      expect(out.role).toBe("member");
    });

    it("returns 404 for a private team (join-by-discovery is not allowed)", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], visibility: "private" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.joinTeam(String(doc._id), "ada")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ConflictException when the user has an open invitation", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], invited: ["ada"], visibility: "public" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.joinTeam(String(doc._id), "ada")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("leaveTeam", () => {
    it("removes the user from members and persists", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.leaveTeam(String(doc._id), "ada");
      expect(doc.members).toEqual(["chen"]);
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

  describe("updateTeam", () => {
    it("patches metadata when the acting user is the admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.updateTeam(String(doc._id), { name: "Renamed Team", visibility: "private" }, "ada");
      expect(doc.name).toBe("Renamed Team");
      expect(doc.visibility).toBe("private");
      expect(out.name).toBe("Renamed Team");
    });

    it("throws ForbiddenException when the acting user is not the admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen", "ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.updateTeam(String(doc._id), { name: "x" }, "ada")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("deleteTeam", () => {
    it("calls deleteOne on the doc when the acting user is the admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.deleteTeam(String(doc._id), "ada");
      expect((doc.deleteOne as jest.Mock)).toHaveBeenCalledTimes(1);
    });
  });

  describe("inviteUser", () => {
    it("invites by username and lands the user in invited[]", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      const out = await service.inviteUser(String(doc._id), "chen", "ada");
      expect(doc.invited).toEqual(["chen"]);
      expect(out.role).toBe("admin");
    });

    it("invites by email and lowercases when looking up", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      await service.inviteUser(String(doc._id), "Chen@example.com", "ada");
      const orFilter = (userModelMock.findOne.mock.calls[0][0] as { $or: { email?: string; username?: string }[] }).$or;
      expect(orFilter.some((c) => c.email === "chen@example.com")).toBe(true);
    });

    it("throws ConflictException when the invitee is already a member", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      await expect(service.inviteUser(String(doc._id), "chen", "ada")).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFoundException when the identifier cannot be resolved", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      await expect(service.inviteUser(String(doc._id), "ghost", "ada")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("acceptInvite / declineInvite", () => {
    it("promotes the invitee to member on accept", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invited: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.acceptInvite(String(doc._id), "chen");
      expect(doc.members).toContain("chen");
      expect(doc.invited).not.toContain("chen");
      expect(out.role).toBe("member");
    });

    it("removes from invited on decline without promoting", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invited: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.declineInvite(String(doc._id), "chen");
      expect(doc.invited).not.toContain("chen");
      expect(doc.members).not.toContain("chen");
    });

    it("throws NotFoundException when there is no open invitation", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invited: [] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.acceptInvite(String(doc._id), "chen")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("kickMember", () => {
    it("removes a member from the roster", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.kickMember(String(doc._id), "chen", "ada");
      expect(doc.members).toEqual(["ada"]);
    });

    it("refuses to kick the admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.kickMember(String(doc._id), "ada", "ada")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
