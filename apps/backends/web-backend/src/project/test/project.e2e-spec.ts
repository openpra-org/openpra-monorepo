import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../../app.module";
import { Project, type ProjectDocument } from "../project.schema";

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

describe("Project (e2e)", () => {
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
    const res = await request(httpServer).get("/api/projects/recent");
    expect(res.status).toBe(401);
  });

  it("creates a project, returns it from /recent, and scaffolds the element status map", async () => {
    const token = await signupAndLogin(httpServer);

    const create = await request(httpServer)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Unit 2 Internal Events Baseline", mode: "internal-events" });
    expect(create.status).toBe(201);
    expect(create.body.modeLabel).toBe("Internal Events");
    expect(create.body.progress).toBe(0);
    expect(Object.keys(create.body.status).length).toBeGreaterThan(0);
    expect(create.body.ownerInitials).toBe("AL");

    const recent = await request(httpServer)
      .get("/api/projects/recent")
      .set("Authorization", `Bearer ${token}`);
    expect(recent.status).toBe(200);
    expect(recent.body.project).not.toBeNull();
    expect(recent.body.project.name).toBe("Unit 2 Internal Events Baseline");
  });

  it("returns 400 when name is shorter than 3 characters", async () => {
    const token = await signupAndLogin(httpServer, { username: "second", email: "second@example.com" });
    const res = await request(httpServer)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "ab", mode: "internal-events" });
    expect(res.status).toBe(400);
  });

  it("returns 400 on unknown risk mode", async () => {
    const token = await signupAndLogin(httpServer, { username: "third", email: "third@example.com" });
    const res = await request(httpServer)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Valid Name Here", mode: "made-up-mode" });
    expect(res.status).toBe(400);
  });

  it("returns null project on /recent when the user has none", async () => {
    const token = await signupAndLogin(httpServer, { username: "fourth", email: "fourth@example.com" });
    const res = await request(httpServer)
      .get("/api/projects/recent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.project).toBeNull();
  });

  it("returns empty array on /shared when the user has no shared projects", async () => {
    const token = await signupAndLogin(httpServer, { username: "fifth", email: "fifth@example.com" });
    const res = await request(httpServer)
      .get("/api/projects/shared")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  it("includes projects in /shared when the user is in the collaborators array", async () => {
    const ownerToken = await signupAndLogin(httpServer, { username: "owner1", email: "owner1@example.com", fullName: "Marie Curie" });
    const collabToken = await signupAndLogin(httpServer, { username: "collab1", email: "collab1@example.com", fullName: "Niels Bohr" });

    const created = await request(httpServer)
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Shared Project Alpha", mode: "full-scope" });
    expect(created.status).toBe(201);

    const projectModel = app.get<Model<ProjectDocument>>(getModelToken(Project.name));
    await projectModel.updateOne({ _id: created.body.id }, { $addToSet: { collaborators: "collab1" } });

    const res = await request(httpServer)
      .get("/api/projects/shared")
      .set("Authorization", `Bearer ${collabToken}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe("Shared Project Alpha");
    expect(res.body.projects[0].ownerFullName).toBe("Marie Curie");
    expect(res.body.projects[0].ownerInitials).toBe("MC");
  });
});
