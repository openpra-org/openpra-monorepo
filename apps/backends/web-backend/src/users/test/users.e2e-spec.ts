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
});
