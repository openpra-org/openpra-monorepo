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

describe("Orgs (e2e)", () => {
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

  it("creates an org on signup and finds it via search", async () => {
    const me = await signupAndLogin(httpServer, { username: "org-me", email: "org-me@example.com", organization: "Reactor Lab" });
    const res = await request(httpServer).get("/api/orgs/search?q=react").set("Authorization", `Bearer ${me}`);
    expect(res.status).toBe(200);
    expect(res.body.orgs.find((o: { name: string }) => o.name === "Reactor Lab")).toBeDefined();
  });

  it("reuses the same org doc (case-insensitive slug match) when two users sign up with the same name", async () => {
    await signupAndLogin(httpServer, { username: "dup1", email: "dup1@example.com", organization: "Quanta Inc" });
    await signupAndLogin(httpServer, { username: "dup2", email: "dup2@example.com", organization: "quanta inc" });
    const viewer = await signupAndLogin(httpServer, { username: "dup-view", email: "dup-view@example.com" });
    const res = await request(httpServer).get("/api/orgs/quanta-inc").set("Authorization", `Bearer ${viewer}`);
    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(2);
  });

  it("returns 404 for an unknown slug", async () => {
    const viewer = await signupAndLogin(httpServer, { username: "org-stranger", email: "org-stranger@example.com" });
    const res = await request(httpServer).get("/api/orgs/no-such-org").set("Authorization", `Bearer ${viewer}`);
    expect(res.status).toBe(404);
  });

  it("requires auth", async () => {
    const res = await request(httpServer).get("/api/orgs/search?q=any");
    expect(res.status).toBe(401);
  });
});
