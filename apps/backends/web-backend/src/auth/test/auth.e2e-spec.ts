import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { jwtDecode } from "jwt-decode";
import { AppModule } from "../../app.module";
import { EmailService } from "../email.service";

const sendMock = jest.fn().mockResolvedValue(undefined);

jest.mock("../email.service", () => {
  return {
    EmailService: jest.fn().mockImplementation(() => ({
      onModuleInit: jest.fn(),
      sendPasswordResetEmail: sendMock,
    })),
  };
});

describe("Auth (e2e)", () => {
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
    process.env["APP_BASE_URL"] = "http://localhost:4201";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
    httpServer = app.getHttpServer();
  }, 90_000);

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  beforeEach(() => {
    sendMock.mockClear();
  });

  const baseSignup = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    organization: "OpenPRA",
    username: "ada",
    password: "hunter2hunter2",
  };

  describe("POST /api/auth/signup", () => {
    it("creates a user and returns 201 with id/username/email", async () => {
      const res = await request(httpServer).post("/api/auth/signup").send(baseSignup);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        username: "ada",
        email: "ada@example.com",
      });
    });

    it("returns 409 on duplicate username", async () => {
      const res = await request(httpServer)
        .post("/api/auth/signup")
        .send({ ...baseSignup, email: "different@example.com" });
      expect(res.status).toBe(409);
    });

    it("returns 409 on duplicate email (case-insensitive)", async () => {
      const res = await request(httpServer)
        .post("/api/auth/signup")
        .send({ ...baseSignup, username: "different", email: "ADA@example.com" });
      expect(res.status).toBe(409);
    });

    it("returns 400 on malformed body", async () => {
      const res = await request(httpServer)
        .post("/api/auth/signup")
        .send({ username: "x", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns a JWT when logging in by username", async () => {
      const res = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ada", password: "hunter2hunter2" });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe("string");
      const decoded = jwtDecode<{ username: string; email: string; roles: string[] }>(res.body.token);
      expect(decoded.username).toBe("ada");
      expect(decoded.email).toBe("ada@example.com");
      expect(decoded.roles).toEqual(["member-role"]);
    });

    it("returns a JWT when logging in by email", async () => {
      const res = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ADA@example.com", password: "hunter2hunter2" });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe("string");
    });

    it("returns 401 on wrong password", async () => {
      const res = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ada", password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    it("returns 401 on unknown user", async () => {
      const res = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ghost", password: "anything" });
      expect(res.status).toBe(401);
    });

    it("returns 400 on malformed body", async () => {
      const res = await request(httpServer).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns 200 and triggers email when the user exists", async () => {
      const res = await request(httpServer)
        .post("/api/auth/forgot-password")
        .send({ identifier: "ada@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.detail).toMatch(/reset link/i);
      expect(sendMock).toHaveBeenCalledTimes(1);
      const [email, url] = sendMock.mock.calls[0];
      expect(email).toBe("ada@example.com");
      expect(url).toMatch(/^http:\/\/localhost:4201\/reset-password\?token=[a-f0-9]{64}$/);
    });

    it("returns 200 and does NOT send email when user is unknown (no existence leak)", async () => {
      const res = await request(httpServer)
        .post("/api/auth/forgot-password")
        .send({ identifier: "ghost@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.detail).toMatch(/reset link/i);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("returns 400 on malformed body", async () => {
      const res = await request(httpServer).post("/api/auth/forgot-password").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("updates the password using a valid token, then login succeeds with the new password", async () => {
      await request(httpServer).post("/api/auth/forgot-password").send({ identifier: "ada" });
      const url = sendMock.mock.calls[0][1] as string;
      const token = new URL(url).searchParams.get("token") ?? "";

      const reset = await request(httpServer)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "brand-new-strong" });
      expect(reset.status).toBe(200);
      expect(reset.body.detail).toMatch(/updated/i);

      const loginNew = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ada", password: "brand-new-strong" });
      expect(loginNew.status).toBe(200);

      const loginOld = await request(httpServer)
        .post("/api/auth/login")
        .send({ identifier: "ada", password: "hunter2hunter2" });
      expect(loginOld.status).toBe(401);
    });

    it("returns 401 when the token does not match any user", async () => {
      const res = await request(httpServer)
        .post("/api/auth/reset-password")
        .send({ token: "0".repeat(64), newPassword: "brand-new-strong" });
      expect(res.status).toBe(401);
    });

    it("returns 400 on malformed body", async () => {
      const res = await request(httpServer).post("/api/auth/reset-password").send({ token: "" });
      expect(res.status).toBe(400);
    });
  });
});
