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

describe("Notifications + Audit (e2e)", () => {
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
    process.env["TFA_ENC_KEY"] = "test-encryption-key-for-2fa";

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

  it("creates a notification for the invitee when a team invite is sent", async () => {
    const owner = await signupAndLogin(httpServer, { username: "nt-owner", email: "nt-owner@example.com" });
    const invitee = await signupAndLogin(httpServer, { username: "nt-invitee", email: "nt-invitee@example.com" });
    const team = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Notify Team", visibility: "private" });
    await request(httpServer)
      .post(`/api/teams/${team.body.id}/invites`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ identifier: "nt-invitee" });

    const list = await request(httpServer).get("/api/notifications").set("Authorization", `Bearer ${invitee}`);
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.notifications[0].type).toBe("team.invited");
    expect(list.body.notifications[0].read).toBe(false);
  });

  it("respects the teamInvite mute preference", async () => {
    const owner = await signupAndLogin(httpServer, { username: "mute-owner", email: "mute-owner@example.com" });
    const invitee = await signupAndLogin(httpServer, { username: "mute-invitee", email: "mute-invitee@example.com" });
    await request(httpServer)
      .patch("/api/users/me/prefs/notifications")
      .set("Authorization", `Bearer ${invitee}`)
      .send({ teamInvite: false });
    const team = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Muted Team", visibility: "private" });
    await request(httpServer)
      .post(`/api/teams/${team.body.id}/invites`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ identifier: "mute-invitee" });

    const count = await request(httpServer).get("/api/notifications/unread-count").set("Authorization", `Bearer ${invitee}`);
    expect(count.body.unreadCount).toBe(0);
  });

  it("marks a notification read", async () => {
    const owner = await signupAndLogin(httpServer, { username: "rd-owner", email: "rd-owner@example.com" });
    const invitee = await signupAndLogin(httpServer, { username: "rd-invitee", email: "rd-invitee@example.com" });
    const team = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Read Team", visibility: "private" });
    await request(httpServer)
      .post(`/api/teams/${team.body.id}/invites`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ identifier: "rd-invitee" });

    const list = await request(httpServer).get("/api/notifications").set("Authorization", `Bearer ${invitee}`);
    const id = list.body.notifications[0].id;
    const read = await request(httpServer).post(`/api/notifications/${id}/read`).set("Authorization", `Bearer ${invitee}`);
    expect(read.status).toBe(204);
    const after = await request(httpServer).get("/api/notifications/unread-count").set("Authorization", `Bearer ${invitee}`);
    expect(after.body.unreadCount).toBe(0);
  });

  it("records an audit entry visible to the team admin but not to a stranger", async () => {
    const owner = await signupAndLogin(httpServer, { username: "au-owner", email: "au-owner@example.com" });
    const member = await signupAndLogin(httpServer, { username: "au-member", email: "au-member@example.com" });
    const team = await request(httpServer)
      .post("/api/teams")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Audit Team", visibility: "public" });
    await request(httpServer).post(`/api/teams/${team.body.id}/join`).set("Authorization", `Bearer ${member}`);

    const log = await request(httpServer).get(`/api/audit/teams/${team.body.id}`).set("Authorization", `Bearer ${owner}`);
    expect(log.status).toBe(200);
    expect(log.body.entries.some((e: { action: string }) => e.action === "team.member_joined")).toBe(true);

    const stranger = await signupAndLogin(httpServer, { username: "au-stranger", email: "au-stranger@example.com" });
    const denied = await request(httpServer).get(`/api/audit/teams/${team.body.id}`).set("Authorization", `Bearer ${stranger}`);
    expect(denied.status).toBe(403);
  });

  it("records a project share in the project audit log (owner only)", async () => {
    const owner = await signupAndLogin(httpServer, { username: "pa-owner", email: "pa-owner@example.com" });
    await signupAndLogin(httpServer, { username: "pa-friend", email: "pa-friend@example.com" });
    const project = await request(httpServer)
      .post("/api/projects")
      .set("Authorization", `Bearer ${owner}`)
      .send({ name: "Audited Project", mode: "internal-events" });
    await request(httpServer)
      .post(`/api/projects/${project.body.id}/shares/users`)
      .set("Authorization", `Bearer ${owner}`)
      .send({ identifier: "pa-friend", role: "editor" });

    const log = await request(httpServer).get(`/api/audit/projects/${project.body.id}`).set("Authorization", `Bearer ${owner}`);
    expect(log.status).toBe(200);
    expect(log.body.entries.some((e: { action: string }) => e.action === "project.shared_user")).toBe(true);
  });
});
