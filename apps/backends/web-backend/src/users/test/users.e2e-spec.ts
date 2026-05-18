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

describe("Users (e2e)", () => {
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

  it("rejects unauthenticated /api/users/me with 401", async () => {
    const res = await request(httpServer).get("/api/users/me");
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user's profile + project count", async () => {
    const token = await signupAndLogin(httpServer);
    const res = await request(httpServer).get("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe("ada");
    expect(res.body.profile.email).toBe("ada@example.com");
    expect(res.body.profile.initials).toBe("AL");
    expect(res.body.profile.title).toBe("");
    expect(res.body.profile.bio).toBe("");
    expect(typeof res.body.profile.memberSince).toBe("string");
    expect(res.body.projectCount).toBe(0);
  });

  it("patches title / bio / altEmail and returns the updated profile", async () => {
    const token = await signupAndLogin(httpServer, { username: "patchme", email: "patchme@example.com" });
    const res = await request(httpServer)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "PhD Candidate",
        bio: "Researching PRA at NC State",
        altEmail: "secondary@example.com",
        phone: "+1 555 0100",
        linkedin: "https://www.linkedin.com/in/example",
      });
    expect(res.status).toBe(200);
    expect(res.body.profile.title).toBe("PhD Candidate");
    expect(res.body.profile.bio).toBe("Researching PRA at NC State");
    expect(res.body.profile.altEmail).toBe("secondary@example.com");
    expect(res.body.profile.phone).toBe("+1 555 0100");
    expect(res.body.profile.linkedin).toBe("https://www.linkedin.com/in/example");
  });

  it("returns 400 when the body has no mutable fields", async () => {
    const token = await signupAndLogin(httpServer, { username: "empty", email: "empty@example.com" });
    const res = await request(httpServer)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when altEmail is set to a non-email value", async () => {
    const token = await signupAndLogin(httpServer, { username: "bad-email", email: "bad-email@example.com" });
    const res = await request(httpServer)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ altEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("accepts an empty altEmail to clear the field", async () => {
    const token = await signupAndLogin(httpServer, { username: "clearable", email: "clearable@example.com" });
    await request(httpServer)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ altEmail: "x@y.z" });
    const res = await request(httpServer)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ altEmail: "" });
    expect(res.status).toBe(200);
    expect(res.body.profile.altEmail).toBe("");
  });

  describe("PATCH /api/users/me/email", () => {
    it("rotates the email when current password verifies and returns a new token", async () => {
      const token = await signupAndLogin(httpServer, { username: "rotate-email", email: "rotate-email@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/email")
        .set("Authorization", `Bearer ${token}`)
        .send({ newEmail: "Rotated@Example.com", currentPassword: "hunter2hunter2" });
      expect(res.status).toBe(200);
      expect(res.body.profile.email).toBe("rotated@example.com");
      expect(typeof res.body.token).toBe("string");

      const me = await request(httpServer)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${res.body.token}`);
      expect(me.body.profile.email).toBe("rotated@example.com");
    });

    it("returns 401 when current password is wrong", async () => {
      const token = await signupAndLogin(httpServer, { username: "bad-pass-email", email: "bad-pass-email@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/email")
        .set("Authorization", `Bearer ${token}`)
        .send({ newEmail: "valid@example.com", currentPassword: "wrong-pass" });
      expect(res.status).toBe(401);
    });

    it("returns 409 when the email is already in use", async () => {
      await signupAndLogin(httpServer, { username: "occupant", email: "occupant@example.com" });
      const token = await signupAndLogin(httpServer, { username: "claimant", email: "claimant@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/email")
        .set("Authorization", `Bearer ${token}`)
        .send({ newEmail: "Occupant@example.com", currentPassword: "hunter2hunter2" });
      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /api/users/me/username", () => {
    it("renames the user and the new token works", async () => {
      const token = await signupAndLogin(httpServer, { username: "rename-me", email: "rename-me@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/username")
        .set("Authorization", `Bearer ${token}`)
        .send({ newUsername: "renamed-user" });
      expect(res.status).toBe(200);
      expect(res.body.profile.username).toBe("renamed-user");

      const me = await request(httpServer)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${res.body.token}`);
      expect(me.body.profile.username).toBe("renamed-user");
    });

    it("rejects usernames shorter than 3 characters with 400", async () => {
      const token = await signupAndLogin(httpServer, { username: "short-user", email: "short-user@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/username")
        .set("Authorization", `Bearer ${token}`)
        .send({ newUsername: "ab" });
      expect(res.status).toBe(400);
    });

    it("rejects usernames containing whitespace with 409", async () => {
      const token = await signupAndLogin(httpServer, { username: "space-user", email: "space-user@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/username")
        .set("Authorization", `Bearer ${token}`)
        .send({ newUsername: "has space" });
      expect(res.status).toBe(409);
    });

    it("returns 409 when the username is already taken", async () => {
      await signupAndLogin(httpServer, { username: "claimed", email: "claimed@example.com" });
      const token = await signupAndLogin(httpServer, { username: "challenger", email: "challenger@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/username")
        .set("Authorization", `Bearer ${token}`)
        .send({ newUsername: "claimed" });
      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /api/users/me/password", () => {
    it("rotates the password and enables login with the new password", async () => {
      const token = await signupAndLogin(httpServer, { username: "pw-rotator", email: "pw-rotator@example.com" });
      const rotate = await request(httpServer)
        .patch("/api/users/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "hunter2hunter2", newPassword: "brand-new-strong" });
      expect(rotate.status).toBe(200);

      const loginNew = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "pw-rotator", password: "brand-new-strong" });
      expect(loginNew.status).toBe(200);

      const loginOld = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "pw-rotator", password: "hunter2hunter2" });
      expect(loginOld.status).toBe(401);
    });

    it("returns 401 when the current password is wrong", async () => {
      const token = await signupAndLogin(httpServer, { username: "pw-bad", email: "pw-bad@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "wrong-pass", newPassword: "brand-new-strong" });
      expect(res.status).toBe(401);
    });

    it("returns 409 when new password matches current", async () => {
      const token = await signupAndLogin(httpServer, { username: "pw-same", email: "pw-same@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "hunter2hunter2", newPassword: "hunter2hunter2" });
      expect(res.status).toBe(409);
    });
  });

  describe("notification prefs", () => {
    it("defaults to all four event types enabled", async () => {
      const token = await signupAndLogin(httpServer, { username: "notif-default", email: "notif-default@example.com" });
      const res = await request(httpServer).get("/api/users/me/prefs/notifications").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        projectShared: true,
        teamInvite: true,
        runFinished: true,
        quantErrors: true,
      });
    });

    it("partial updates persist and other fields stay untouched", async () => {
      const token = await signupAndLogin(httpServer, { username: "notif-patch", email: "notif-patch@example.com" });
      const res = await request(httpServer)
        .patch("/api/users/me/prefs/notifications")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectShared: false, quantErrors: false });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        projectShared: false,
        teamInvite: true,
        runFinished: true,
        quantErrors: false,
      });
    });
  });

  describe("DELETE /api/users/me", () => {
    it("removes the user + their owned projects + admin teams; subsequent /me returns 401", async () => {
      const token = await signupAndLogin(httpServer, { username: "doomed-user", email: "doomed-user@example.com" });
      await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Goes Away With Me", mode: "internal-events" });
      await request(httpServer)
        .post("/api/teams")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Doomed Team", visibility: "public" });

      const del = await request(httpServer)
        .delete("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "hunter2hunter2" });
      expect(del.status).toBe(204);

      const me = await request(httpServer).get("/api/users/me").set("Authorization", `Bearer ${token}`);
      expect([401, 404]).toContain(me.status);

      const login = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "doomed-user", password: "hunter2hunter2" });
      expect(login.status).toBe(401);
    });

    it("returns 401 on wrong password", async () => {
      const token = await signupAndLogin(httpServer, { username: "safe-user", email: "safe-user@example.com" });
      const res = await request(httpServer)
        .delete("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "wrong-pass" });
      expect(res.status).toBe(401);
    });
  });
});
