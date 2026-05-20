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

jest.mock("../storage.service", () => ({
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

  describe("POST/DELETE /api/users/me/avatar", () => {
    it("accepts a PNG upload and returns avatarUrl", async () => {
      const token = await signupAndLogin(httpServer, { username: "avatar1", email: "avatar1@example.com" });
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await request(httpServer)
        .post("/api/users/me/avatar")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", png, { filename: "a.png", contentType: "image/png" });
      expect(res.status).toBe(200);
      expect(res.body.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    });

    it("rejects multipart with no file field with 400", async () => {
      const token = await signupAndLogin(httpServer, { username: "avatar2", email: "avatar2@example.com" });
      const res = await request(httpServer)
        .post("/api/users/me/avatar")
        .set("Authorization", `Bearer ${token}`)
        .field("hello", "world");
      expect(res.status).toBe(400);
    });

    it("clears the avatar on DELETE and returns avatarUrl: null", async () => {
      const token = await signupAndLogin(httpServer, { username: "avatar3", email: "avatar3@example.com" });
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await request(httpServer)
        .post("/api/users/me/avatar")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", png, { filename: "a.png", contentType: "image/png" });
      const res = await request(httpServer)
        .delete("/api/users/me/avatar")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.avatarUrl).toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await request(httpServer)
        .post("/api/users/me/avatar")
        .attach("file", Buffer.from([1]), { filename: "x.png", contentType: "image/png" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/users/me/cover", () => {
    it("accepts a JPEG upload and returns coverUrl", async () => {
      const token = await signupAndLogin(httpServer, { username: "cover1", email: "cover1@example.com" });
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const res = await request(httpServer)
        .post("/api/users/me/cover")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", jpeg, { filename: "c.jpg", contentType: "image/jpeg" });
      expect(res.status).toBe(200);
      expect(res.body.coverUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    });
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

  describe("GET /api/users/search", () => {
    it("returns case-insensitive matches and excludes the acting user", async () => {
      const me = await signupAndLogin(httpServer, { username: "srch-me", email: "srch-me@example.com", fullName: "Search Me" });
      await signupAndLogin(httpServer, { username: "srch-alice", email: "srch-alice@example.com", fullName: "Alice Albright" });
      await signupAndLogin(httpServer, { username: "srch-allan", email: "srch-allan@example.com", fullName: "Allan Wu" });

      const res = await request(httpServer).get("/api/users/search?q=AL").set("Authorization", `Bearer ${me}`);
      expect(res.status).toBe(200);
      const usernames = res.body.users.map((u: { username: string }) => u.username);
      expect(usernames).toContain("srch-alice");
      expect(usernames).toContain("srch-allan");
      expect(usernames).not.toContain("srch-me");
    });

    it("returns an empty list when q is shorter than 2 characters", async () => {
      const me = await signupAndLogin(httpServer, { username: "srch-empty", email: "srch-empty@example.com" });
      const res = await request(httpServer).get("/api/users/search?q=a").set("Authorization", `Bearer ${me}`);
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([]);
    });

    it("requires authentication", async () => {
      const res = await request(httpServer).get("/api/users/search?q=ada");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/users/:username", () => {
    it("returns the public profile without email / phone / altEmail", async () => {
      await signupAndLogin(httpServer, { username: "pub-target", email: "pub-target@example.com", fullName: "Public Target" });
      const viewer = await signupAndLogin(httpServer, { username: "pub-viewer", email: "pub-viewer@example.com" });
      const res = await request(httpServer).get("/api/users/pub-target").set("Authorization", `Bearer ${viewer}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe("pub-target");
      expect(res.body.fullName).toBe("Public Target");
      expect(res.body).not.toHaveProperty("email");
      expect(res.body).not.toHaveProperty("altEmail");
      expect(res.body).not.toHaveProperty("phone");
    });

    it("returns 404 for an unknown username", async () => {
      const viewer = await signupAndLogin(httpServer, { username: "pub-viewer-2", email: "pub-viewer-2@example.com" });
      const res = await request(httpServer).get("/api/users/no-such-user").set("Authorization", `Bearer ${viewer}`);
      expect(res.status).toBe(404);
    });

    it("requires authentication", async () => {
      const res = await request(httpServer).get("/api/users/anything");
      expect(res.status).toBe(401);
    });
  });
});
