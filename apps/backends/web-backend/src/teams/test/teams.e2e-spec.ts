import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../../app.module";

jest.mock("../../auth/email.service", () => {
  return {
    EmailService: jest.fn().mockImplementation(() => ({
      onModuleInit: jest.fn(),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

jest.mock("../../users/storage.service", () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    onModuleInit: jest.fn(),
    isAllowedMime: jest.fn().mockReturnValue(true),
    uploadImage: jest.fn().mockResolvedValue("avatars/test/mocked.png"),
    deleteByKey: jest.fn().mockResolvedValue(undefined),
    urlForKey: jest.fn().mockImplementation((key: string | null) => (key === null ? null : `https://cdn.example.com/${key}`)),
  })),
}));

async function signupAndLogin(httpServer: ReturnType<INestApplication["getHttpServer"]>, overrides: Record<string, string> = {}): Promise<string> {
  const user = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    organization: "OpenPRA",
    username: "ada",
    password: "hunter2hunter2",
    ...overrides,
  };
  await request(httpServer).post("/api/auth/signup").send(user);
  const login = await request(httpServer).post("/api/auth/login").send({ identifier: user.username, password: user.password });
  return login.body.token as string;
}

describe("Teams (e2e)", () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env["MONGO_URI"] = mongo.getUri();
    process.env["JWT_SECRET"] = "test-secret";
    process.env["JWT_EXPIRES_IN"] = "1h";
    process.env["RESEND_API_KEY"] = "re_test";
    process.env["MAIL_FROM"] = "noreply@example.com";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
    httpServer = app.getHttpServer();
  }, 90_000);

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(httpServer).get("/api/teams/mine");
    expect(res.status).toBe(401);
  });

  it("creates a team with creator as admin + sole member", async () => {
    const token = await signupAndLogin(httpServer, { username: "creator", email: "creator@example.com" });
    const res = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Risk Research Group", organization: "NC State", description: "PRA team", visibility: "public" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Risk Research Group");
    expect(res.body.adminUsername).toBe("creator");
    expect(res.body.memberCount).toBe(1);
    expect(res.body.role).toBe("admin");
  });

  it("returns 400 when team name is shorter than 3 characters", async () => {
    const token = await signupAndLogin(httpServer, { username: "shortname", email: "shortname@example.com" });
    const res = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "ab", visibility: "public" });
    expect(res.status).toBe(400);
  });

  it("lists the user's own teams in /teams/mine", async () => {
    const a = await signupAndLogin(httpServer, { username: "a-user", email: "a-user@example.com" });
    await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${a}`)
      .send({ name: "My Group", visibility: "private" });
    const res = await request(httpServer).get("/api/teams/mine").set("Authorization", `Bearer ${a}`);
    expect(res.status).toBe(200);
    expect(res.body.teams.length).toBeGreaterThanOrEqual(1);
    expect(res.body.teams[0].role).toBe("admin");
  });

  it("excludes teams the user already belongs to from /teams/available", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-x", email: "owner-x@example.com" });
    await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Owner's Group", visibility: "public" });
    const res = await request(httpServer).get("/api/teams/available").set("Authorization", `Bearer ${owner}`);
    expect(res.status).toBe(200);
    expect(res.body.teams.find((t: { adminUsername: string }) => t.adminUsername === "owner-x")).toBeUndefined();
  });

  it("filters /teams/available by q against name / org / description", async () => {
    const owner = await signupAndLogin(httpServer, { username: "search-owner", email: "search-owner@example.com" });
    await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Seismic Analysts", organization: "OpenPRA", visibility: "public" });
    await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Cyber Pilot", organization: "OpenPRA", visibility: "public" });

    const stranger = await signupAndLogin(httpServer, { username: "stranger", email: "stranger@example.com" });
    const res = await request(httpServer)
      .get("/api/teams/available?q=seismic")
      .set("Authorization", `Bearer ${stranger}`);
    expect(res.status).toBe(200);
    expect(res.body.teams.length).toBe(1);
    expect(res.body.teams[0].name).toBe("Seismic Analysts");
  });

  it("joins a public team as 'member' immediately", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-pub", email: "owner-pub@example.com" });
    const created = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Public Group", visibility: "public" });
    const joiner = await signupAndLogin(httpServer, { username: "joiner-pub", email: "joiner-pub@example.com" });
    const res = await request(httpServer)
      .post(`/api/teams/${created.body.id}/join`)
      .set("Authorization", `Bearer ${joiner}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("member");
    expect(res.body.memberCount).toBe(2);
  });

  it("returns 404 when joining a private team (join-by-discovery is not allowed)", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-priv", email: "owner-priv@example.com" });
    const created = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Private Group", visibility: "private" });
    const joiner = await signupAndLogin(httpServer, { username: "joiner-priv", email: "joiner-priv@example.com" });
    const res = await request(httpServer)
      .post(`/api/teams/${created.body.id}/join`)
      .set("Authorization", `Bearer ${joiner}`);
    expect(res.status).toBe(404);
  });

  it("returns 409 when the user is already a member", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-dup", email: "owner-dup@example.com" });
    const created = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Dup Group", visibility: "public" });
    const res = await request(httpServer)
      .post(`/api/teams/${created.body.id}/join`)
      .set("Authorization", `Bearer ${owner}`);
    expect(res.status).toBe(409);
  });

  it("leaves a team and disappears from /teams/mine", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-leave", email: "owner-leave@example.com" });
    const created = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Leavable Group", visibility: "public" });
    const member = await signupAndLogin(httpServer, { username: "member-leave", email: "member-leave@example.com" });
    await request(httpServer)
      .post(`/api/teams/${created.body.id}/join`)
      .set("Authorization", `Bearer ${member}`);
    const leave = await request(httpServer)
      .delete(`/api/teams/${created.body.id}/membership`)
      .set("Authorization", `Bearer ${member}`);
    expect(leave.status).toBe(204);
    const mine = await request(httpServer).get("/api/teams/mine").set("Authorization", `Bearer ${member}`);
    expect(mine.body.teams.find((t: { id: string }) => t.id === created.body.id)).toBeUndefined();
  });

  it("forbids an admin from leaving their own team (403)", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-admin-leave", email: "owner-admin-leave@example.com" });
    const created = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Admin Locked Group", visibility: "public" });
    const res = await request(httpServer)
      .delete(`/api/teams/${created.body.id}/membership`)
      .set("Authorization", `Bearer ${owner}`);
    expect(res.status).toBe(403);
  });

  it("hides private teams from /teams/available", async () => {
    const owner = await signupAndLogin(httpServer, { username: "owner-hide", email: "owner-hide@example.com" });
    await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Private Group Hide", visibility: "private" });
    const stranger = await signupAndLogin(httpServer, { username: "stranger-hide", email: "stranger-hide@example.com" });
    const res = await request(httpServer).get("/api/teams/available").set("Authorization", `Bearer ${stranger}`);
    expect(res.body.teams.find((t: { name: string }) => t.name === "Private Group Hide")).toBeUndefined();
  });

  describe("PATCH /api/teams/:id", () => {
    it("admin can update name + visibility", async () => {
      const owner = await signupAndLogin(httpServer, { username: "edit-owner", email: "edit-owner@example.com" });
      const created = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Editable Team", visibility: "public" });
      const res = await request(httpServer)
        .patch(`/api/teams/${created.body.id}`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Renamed Team", visibility: "private" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Renamed Team");
      expect(res.body.visibility).toBe("private");
    });

    it("non-admin gets 403", async () => {
      const owner = await signupAndLogin(httpServer, { username: "edit-owner-2", email: "edit-owner-2@example.com" });
      const created = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Locked Team", visibility: "public" });
      const intruder = await signupAndLogin(httpServer, { username: "intruder-edit", email: "intruder-edit@example.com" });
      const res = await request(httpServer)
        .patch(`/api/teams/${created.body.id}`)
        .set("Authorization", `Bearer ${intruder}`)
        .send({ name: "Hacked" });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/teams/:id", () => {
    it("admin can delete the team", async () => {
      const owner = await signupAndLogin(httpServer, { username: "del-owner", email: "del-owner@example.com" });
      const created = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Deletable Team", visibility: "public" });
      const res = await request(httpServer)
        .delete(`/api/teams/${created.body.id}`)
        .set("Authorization", `Bearer ${owner}`);
      expect(res.status).toBe(204);
    });
  });

  describe("Team detail visibility", () => {
    it("hides a private team from non-members with 404", async () => {
      const owner = await signupAndLogin(httpServer, { username: "priv-owner", email: "priv-owner@example.com" });
      const created = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Hidden Detail", visibility: "private" });
      const stranger = await signupAndLogin(httpServer, { username: "priv-stranger", email: "priv-stranger@example.com" });
      const res = await request(httpServer).get(`/api/teams/${created.body.id}`).set("Authorization", `Bearer ${stranger}`);
      expect(res.status).toBe(404);
    });

    it("returns roster + invited for the admin", async () => {
      const owner = await signupAndLogin(httpServer, { username: "detail-owner", email: "detail-owner@example.com", fullName: "Owner User" });
      const inviteeFull = await signupAndLogin(httpServer, { username: "invitee-user", email: "invitee-user@example.com", fullName: "Invited Person" });
      void inviteeFull;
      const created = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Detailed Team", visibility: "private" });
      await request(httpServer)
        .post(`/api/teams/${created.body.id}/invites`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifier: "invitee-user" });
      const res = await request(httpServer).get(`/api/teams/${created.body.id}`).set("Authorization", `Bearer ${owner}`);
      expect(res.status).toBe(200);
      expect(res.body.members.map((m: { username: string }) => m.username)).toEqual(["detail-owner"]);
      expect(res.body.invited.map((m: { username: string }) => m.username)).toEqual(["invitee-user"]);
      expect(res.body.invited[0].fullName).toBe("Invited Person");
    });
  });

  describe("Invite flow", () => {
    it("admin invites by username, invitee sees the team in /teams/invitations and can accept", async () => {
      const owner = await signupAndLogin(httpServer, { username: "inv-owner-1", email: "inv-owner-1@example.com" });
      const invitee = await signupAndLogin(httpServer, { username: "inv-user-1", email: "inv-user-1@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Invite Team A", visibility: "private" });
      const invite = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifier: "inv-user-1" });
      expect(invite.status).toBe(201);

      const list = await request(httpServer).get("/api/teams/invitations").set("Authorization", `Bearer ${invitee}`);
      expect(list.status).toBe(200);
      expect(list.body.teams).toHaveLength(1);
      expect(list.body.teams[0].role).toBe("invited");

      const accept = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites/me/accept`)
        .set("Authorization", `Bearer ${invitee}`);
      expect(accept.status).toBe(200);
      expect(accept.body.role).toBe("member");
    });

    it("admin invites by email (case-insensitive)", async () => {
      const owner = await signupAndLogin(httpServer, { username: "inv-owner-2", email: "inv-owner-2@example.com" });
      await signupAndLogin(httpServer, { username: "inv-user-2", email: "Invited2@Example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Invite Team B", visibility: "private" });
      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifier: "INVITED2@example.com" });
      expect(res.status).toBe(201);
    });

    it("declined invitation removes the team from /teams/invitations without joining", async () => {
      const owner = await signupAndLogin(httpServer, { username: "inv-owner-3", email: "inv-owner-3@example.com" });
      const invitee = await signupAndLogin(httpServer, { username: "inv-user-3", email: "inv-user-3@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Invite Team C", visibility: "private" });
      await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifier: "inv-user-3" });
      const decline = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/invites/me`)
        .set("Authorization", `Bearer ${invitee}`);
      expect(decline.status).toBe(204);
      const after = await request(httpServer).get("/api/teams/invitations").set("Authorization", `Bearer ${invitee}`);
      expect(after.body.teams).toEqual([]);
    });

    it("returns 404 when no identifier resolves", async () => {
      const owner = await signupAndLogin(httpServer, { username: "inv-owner-4", email: "inv-owner-4@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Invite Team D", visibility: "private" });
      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifier: "no-such-user" });
      expect(res.status).toBe(404);
    });
  });

  describe("Kick member", () => {
    it("admin removes a regular member", async () => {
      const owner = await signupAndLogin(httpServer, { username: "kick-owner", email: "kick-owner@example.com" });
      const member = await signupAndLogin(httpServer, { username: "kick-member", email: "kick-member@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Kickable Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${member}`);

      const res = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/members/kick-member`)
        .set("Authorization", `Bearer ${owner}`);
      expect(res.status).toBe(204);
    });

    it("refuses to kick the admin", async () => {
      const owner = await signupAndLogin(httpServer, { username: "kick-owner-2", email: "kick-owner-2@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Self Kick Team", visibility: "public" });
      const res = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/members/kick-owner-2`)
        .set("Authorization", `Bearer ${owner}`);
      expect(res.status).toBe(403);
    });
  });

  describe("Lead role + transfer admin", () => {
    it("admin promotes a member to lead and demotes them back", async () => {
      const owner = await signupAndLogin(httpServer, { username: "ld-owner", email: "ld-owner@example.com" });
      const lead = await signupAndLogin(httpServer, { username: "ld-lead", email: "ld-lead@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Lead Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${lead}`);

      const promote = await request(httpServer)
        .post(`/api/teams/${team.body.id}/leads/ld-lead`)
        .set("Authorization", `Bearer ${owner}`);
      expect(promote.status).toBe(200);

      const detail = await request(httpServer)
        .get(`/api/teams/${team.body.id}`)
        .set("Authorization", `Bearer ${lead}`);
      expect(detail.body.role).toBe("lead");
      expect(detail.body.members.find((m: { username: string }) => m.username === "ld-lead").role).toBe("lead");

      const demote = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/leads/ld-lead`)
        .set("Authorization", `Bearer ${owner}`);
      expect(demote.status).toBe(200);
    });

    it("a lead can invite users (admin gate widens to manager)", async () => {
      const owner = await signupAndLogin(httpServer, { username: "lmi-owner", email: "lmi-owner@example.com" });
      const lead = await signupAndLogin(httpServer, { username: "lmi-lead", email: "lmi-lead@example.com" });
      await signupAndLogin(httpServer, { username: "lmi-invitee", email: "lmi-invitee@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Lead Invite Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${lead}`);
      await request(httpServer)
        .post(`/api/teams/${team.body.id}/leads/lmi-lead`)
        .set("Authorization", `Bearer ${owner}`);

      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${lead}`)
        .send({ identifier: "lmi-invitee" });
      expect(res.status).toBe(201);
    });

    it("a plain member cannot invite (403)", async () => {
      const owner = await signupAndLogin(httpServer, { username: "pmi-owner", email: "pmi-owner@example.com" });
      const member = await signupAndLogin(httpServer, { username: "pmi-mbr", email: "pmi-mbr@example.com" });
      await signupAndLogin(httpServer, { username: "pmi-invitee", email: "pmi-invitee@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Plain Member Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${member}`);

      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites`)
        .set("Authorization", `Bearer ${member}`)
        .send({ identifier: "pmi-invitee" });
      expect(res.status).toBe(403);
    });

    it("admin transfers admin to an existing member, and can then leave the team", async () => {
      const owner = await signupAndLogin(httpServer, { username: "tx-owner", email: "tx-owner@example.com" });
      const heir = await signupAndLogin(httpServer, { username: "tx-heir", email: "tx-heir@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Transfer Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${heir}`);

      const transfer = await request(httpServer)
        .post(`/api/teams/${team.body.id}/transfer-admin`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ username: "tx-heir" });
      expect(transfer.status).toBe(200);
      expect(transfer.body.adminUsername).toBe("tx-heir");

      const leave = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/membership`)
        .set("Authorization", `Bearer ${owner}`);
      expect(leave.status).toBe(204);
    });

    it("transfer-admin to a non-member returns 400", async () => {
      const owner = await signupAndLogin(httpServer, { username: "tx-bad-owner", email: "tx-bad-owner@example.com" });
      await signupAndLogin(httpServer, { username: "tx-stranger", email: "tx-stranger@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Bad Transfer Team", visibility: "public" });
      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/transfer-admin`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ username: "tx-stranger" });
      expect(res.status).toBe(400);
    });
  });

  describe("Bulk invite + team avatar", () => {
    it("bulk invites with a per-identifier status array", async () => {
      const owner = await signupAndLogin(httpServer, { username: "bk-owner", email: "bk-owner@example.com" });
      await signupAndLogin(httpServer, { username: "bk-a", email: "bk-a@example.com" });
      await signupAndLogin(httpServer, { username: "bk-b", email: "bk-b@example.com" });
      const member = await signupAndLogin(httpServer, { username: "bk-member", email: "bk-member@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Bulk Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${member}`);

      const res = await request(httpServer)
        .post(`/api/teams/${team.body.id}/invites/bulk`)
        .set("Authorization", `Bearer ${owner}`)
        .send({ identifiers: ["bk-a", "bk-b", "bk-member", "bk-ghost"] });
      expect(res.status).toBe(200);
      const byId = new Map(res.body.results.map((r: { identifier: string; status: string }) => [r.identifier, r.status]));
      expect(byId.get("bk-a")).toBe("invited");
      expect(byId.get("bk-b")).toBe("invited");
      expect(byId.get("bk-member")).toBe("already-member");
      expect(byId.get("bk-ghost")).toBe("not-found");

      const aToken = await request(httpServer).post("/api/auth/login").send({ identifier: "bk-a", password: "hunter2hunter2" });
      const inv = await request(httpServer).get("/api/teams/invitations").set("Authorization", `Bearer ${aToken.body.token}`);
      expect(inv.body.teams).toHaveLength(1);
    });

    it("admin uploads then clears a team avatar; non-admin is forbidden", async () => {
      const owner = await signupAndLogin(httpServer, { username: "av-owner", email: "av-owner@example.com" });
      const member = await signupAndLogin(httpServer, { username: "av-member", email: "av-member@example.com" });
      const team = await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Avatar Team", visibility: "public" });
      await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${member}`);

      const upload = await request(httpServer)
        .post(`/api/teams/${team.body.id}/avatar`)
        .set("Authorization", `Bearer ${owner}`)
        .attach("file", Buffer.from([1, 2, 3]), { filename: "logo.png", contentType: "image/png" });
      expect(upload.status).toBe(200);
      expect(upload.body.avatarUrl).not.toBeNull();

      const denied = await request(httpServer)
        .post(`/api/teams/${team.body.id}/avatar`)
        .set("Authorization", `Bearer ${member}`)
        .attach("file", Buffer.from([1, 2, 3]), { filename: "logo.png", contentType: "image/png" });
      expect(denied.status).toBe(403);

      const cleared = await request(httpServer)
        .delete(`/api/teams/${team.body.id}/avatar`)
        .set("Authorization", `Bearer ${owner}`);
      expect(cleared.status).toBe(200);
      expect(cleared.body.avatarUrl).toBeNull();
    });
  });
});
