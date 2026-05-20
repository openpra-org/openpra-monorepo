import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { TeamsService } from "../teams.service";
import { Team } from "../team.schema";
import { User } from "../../users/user.schema";
import { OrgsService } from "../../orgs/orgs.service";
import { EventBus } from "../../events/event-bus";
import { StorageService } from "../../users/storage.service";

function futureInvite(username: string, invitedBy = "ada"): { username: string; invitedBy: string; expiresAt: Date } {
  return { username, invitedBy, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
}

function pastInvite(username: string, invitedBy = "ada"): { username: string; invitedBy: string; expiresAt: Date } {
  return { username, invitedBy, expiresAt: new Date(Date.now() - 60 * 1000) };
}

function makeTeamDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  const markModified = jest.fn();
  return {
    _id: new Types.ObjectId().toHexString(),
    name: "Risk & Reliability Research Group",
    organization: "NC State",
    description: "PRA collaboration group",
    visibility: "public",
    adminUsername: "ada",
    members: ["ada"],
    leads: [],
    invites: [],
    avatarKey: null,
    save,
    deleteOne,
    markModified,
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
  let storageMock: { urlForKey: jest.Mock; isAllowedMime: jest.Mock; uploadImage: jest.Mock; deleteByKey: jest.Mock };

  beforeEach(async () => {
    teamModelMock = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
      findById: jest.fn(),
    };
    userModelMock = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const orgsServiceMock = {
      findOrCreate: jest.fn().mockImplementation((name: string) =>
        Promise.resolve(name.trim() === "" ? null : { id: "org-id", name: name.trim() }),
      ),
    };
    const eventBusMock = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
    storageMock = {
      urlForKey: jest.fn().mockImplementation((key: string | null) => (key === null ? null : `https://cdn.example.com/${key}`)),
      isAllowedMime: jest.fn().mockReturnValue(true),
      uploadImage: jest.fn().mockResolvedValue("team-avatars/x/logo.png"),
      deleteByKey: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getModelToken(Team.name), useValue: teamModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: OrgsService, useValue: orgsServiceMock },
        { provide: EventBus, useValue: eventBusMock },
        { provide: StorageService, useValue: storageMock },
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
      expect(arg.leads).toEqual([]);
      expect(arg.invites).toEqual([]);
      expect(out.role).toBe("admin");
      expect(out.memberCount).toBe(1);
      expect(out.avatarUrl).toBeNull();
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
    it("returns teams where the user has an active invite, with role='invited'", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], invites: [futureInvite("ada", "chen")], visibility: "private" });
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
      expect(filter["invites.username"]).toEqual({ $ne: "ada" });
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

    it("returns roster + invited (with invitedBy + expiresAt) for the admin", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada", "chen"],
        invites: [futureInvite("carol", "ada")],
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
      expect(out.members.map((m) => m.role)).toEqual(["admin", "member"]);
      expect(out.invited.map((m) => m.username)).toEqual(["carol"]);
      expect(out.invited[0].invitedBy).toBe("ada");
      expect(typeof out.invited[0].expiresAt).toBe("string");
    });

    it("excludes expired invites from the invited list", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada"],
        invites: [futureInvite("carol"), pastInvite("dave")],
        visibility: "private",
      });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.find.mockImplementation(() => ({
        lean: () => Promise.resolve([
          { username: "ada", fullName: "Ada Lovelace" },
          { username: "carol", fullName: "Carol R" },
        ]),
      }));
      const out = await service.getTeamDetail(String(doc._id), "ada");
      expect(out.invited.map((m) => m.username)).toEqual(["carol"]);
    });

    it("tags lead members with role='lead' on the roster", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada", "chen", "bob"],
        leads: ["chen"],
        visibility: "private",
      });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.find.mockImplementation(() => ({
        lean: () => Promise.resolve([
          { username: "ada", fullName: "Ada Lovelace" },
          { username: "chen", fullName: "M. Chen" },
          { username: "bob", fullName: "Bob Q" },
        ]),
      }));
      const out = await service.getTeamDetail(String(doc._id), "ada");
      const byName = new Map(out.members.map((m) => [m.username, m.role]));
      expect(byName.get("ada")).toBe("admin");
      expect(byName.get("chen")).toBe("lead");
      expect(byName.get("bob")).toBe("member");
    });

    it("lets leads see the invited list (not just admins)", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada", "chen"],
        leads: ["chen"],
        invites: [futureInvite("carol")],
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
      const out = await service.getTeamDetail(String(doc._id), "chen");
      expect(out.role).toBe("lead");
      expect(out.invited.map((m) => m.username)).toEqual(["carol"]);
    });

    it("returns only the inviting team for the invitee, with members + own invitation only", async () => {
      const doc = makeTeamDoc({
        adminUsername: "ada",
        members: ["ada"],
        invites: [futureInvite("chen"), futureInvite("bob")],
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

    it("throws ConflictException when the user has an active invitation", async () => {
      const doc = makeTeamDoc({ adminUsername: "chen", members: ["chen"], invites: [futureInvite("ada", "chen")], visibility: "public" });
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
    it("invites by username and lands the user in invites[]", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      const out = await service.inviteUser(String(doc._id), "chen", "ada");
      expect((doc.invites as { username: string }[]).map((i) => i.username)).toEqual(["chen"]);
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

    it("re-invites (refreshes expiry) when the previous invite has expired", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [pastInvite("chen")] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      await service.inviteUser(String(doc._id), "chen", "ada");
      const invites = doc.invites as { username: string; expiresAt: Date }[];
      expect(invites).toHaveLength(1);
      expect(invites[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("throws ConflictException when the invitee is already a member", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      await expect(service.inviteUser(String(doc._id), "chen", "ada")).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws ConflictException when the invitee already has an active invite", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [futureInvite("chen")] });
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

  describe("bulkInvite", () => {
    it("returns a per-identifier status array and only invites resolvable non-members", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], invites: [futureInvite("dave")] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockImplementation((filter: { $or: { username?: string; email?: string }[] }) => {
        const id = filter.$or[0].username;
        const known: Record<string, string> = { chen: "M. Chen", dave: "Dave D", bob: "Bob Q" };
        return { lean: () => Promise.resolve(id !== undefined && id in known ? { username: id, fullName: known[id] } : null) };
      });

      const out = await service.bulkInvite(String(doc._id), ["bob", "chen", "dave", "ghost"], "ada");
      const byId = new Map(out.results.map((r) => [r.identifier, r.status]));
      expect(byId.get("bob")).toBe("invited");
      expect(byId.get("chen")).toBe("already-member");
      expect(byId.get("dave")).toBe("already-invited");
      expect(byId.get("ghost")).toBe("not-found");
      expect((doc.invites as { username: string }[]).some((i) => i.username === "bob")).toBe(true);
    });

    it("requires admin or lead", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.bulkInvite(String(doc._id), ["bob"], "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("acceptInvite / declineInvite", () => {
    it("promotes the invitee to member on accept", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [futureInvite("chen")] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.acceptInvite(String(doc._id), "chen");
      expect(doc.members).toContain("chen");
      expect((doc.invites as { username: string }[]).some((i) => i.username === "chen")).toBe(false);
      expect(out.role).toBe("member");
    });

    it("rejects an expired invite with BadRequestException and drops it", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [pastInvite("chen")] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.acceptInvite(String(doc._id), "chen")).rejects.toBeInstanceOf(BadRequestException);
      expect((doc.invites as { username: string }[]).some((i) => i.username === "chen")).toBe(false);
    });

    it("removes from invites on decline without promoting", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [futureInvite("chen")] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.declineInvite(String(doc._id), "chen");
      expect((doc.invites as { username: string }[]).some((i) => i.username === "chen")).toBe(false);
      expect(doc.members).not.toContain("chen");
    });

    it("throws NotFoundException when there is no invitation", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"], invites: [] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.acceptInvite(String(doc._id), "chen")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("kickMember", () => {
    it("removes a member from the roster (admin acting)", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.kickMember(String(doc._id), "chen", "ada");
      expect(doc.members).toEqual(["ada"]);
    });

    it("lets a lead kick a regular member", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen", "bob"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.kickMember(String(doc._id), "bob", "chen");
      expect(doc.members).toEqual(["ada", "chen"]);
    });

    it("forbids a lead from kicking another lead", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen", "bob"], leads: ["chen", "bob"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.kickMember(String(doc._id), "bob", "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("forbids a plain member from kicking anyone", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen", "bob"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.kickMember(String(doc._id), "bob", "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses to kick the admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.kickMember(String(doc._id), "ada", "ada")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("inviteUser (manager gate)", () => {
    it("lets a lead invite users", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "bob", fullName: "Bob Q" }),
      });
      await service.inviteUser(String(doc._id), "bob", "chen");
      expect((doc.invites as { username: string }[]).map((i) => i.username)).toEqual(["bob"]);
    });

    it("forbids a plain member from inviting", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.inviteUser(String(doc._id), "bob", "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("transferAdmin", () => {
    it("transfers admin to an existing member", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.transferAdmin(String(doc._id), "chen", "ada");
      expect(doc.adminUsername).toBe("chen");
      expect(doc.members).toContain("ada");
      expect(out.adminUsername).toBe("chen");
    });

    it("demotes the new admin from leads if they were a lead", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.transferAdmin(String(doc._id), "chen", "ada");
      expect(doc.leads).not.toContain("chen");
    });

    it("rejects transfer to a non-member with BadRequestException", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.transferAdmin(String(doc._id), "chen", "ada")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when acting user is not the admin (403)", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.transferAdmin(String(doc._id), "ada", "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("promoteToLead / demoteFromLead", () => {
    it("admin promotes a member to lead", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.promoteToLead(String(doc._id), "chen", "ada");
      expect(doc.leads).toEqual(["chen"]);
    });

    it("admin demotes a lead back to member", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.demoteFromLead(String(doc._id), "chen", "ada");
      expect(doc.leads).toEqual([]);
    });

    it("forbids non-admins from promoting", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen", "bob"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.promoteToLead(String(doc._id), "bob", "chen")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws ConflictException when the target is already a lead", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.promoteToLead(String(doc._id), "chen", "ada")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("team avatar", () => {
    it("admin uploads an avatar and the DTO exposes the URL", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      storageMock.uploadImage.mockResolvedValueOnce("team-avatars/t/logo.png");
      const out = await service.setAvatar(
        String(doc._id),
        { buffer: Buffer.from([1]), mimetype: "image/png", size: 1, originalname: "l.png" },
        "ada",
      );
      expect(doc.avatarKey).toBe("team-avatars/t/logo.png");
      expect(out.avatarUrl).toBe("https://cdn.example.com/team-avatars/t/logo.png");
    });

    it("rejects an avatar upload from a non-admin", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", members: ["ada", "chen"], leads: ["chen"] });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.setAvatar(String(doc._id), { buffer: Buffer.from([1]), mimetype: "image/png", size: 1, originalname: "l.png" }, "chen"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("clears the avatar", async () => {
      const doc = makeTeamDoc({ adminUsername: "ada", avatarKey: "team-avatars/t/logo.png" });
      teamModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.clearAvatar(String(doc._id), "ada");
      expect(doc.avatarKey).toBeNull();
      expect(out.avatarUrl).toBeNull();
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("team-avatars/t/logo.png");
    });
  });
});
