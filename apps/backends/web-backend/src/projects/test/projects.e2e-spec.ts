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

describe("Projects (e2e)", () => {
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

  describe("GET /api/projects", () => {
    it("returns every owned project sorted by updatedAt desc", async () => {
      const token = await signupAndLogin(httpServer, { username: "list1", email: "list1@example.com" });
      await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Alpha Project", mode: "internal-events" });
      await new Promise((r) => setTimeout(r, 10));
      await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Beta Project", mode: "internal-events" });

      const res = await request(httpServer).get("/api/projects").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(2);
      expect(res.body.projects[0].name).toBe("Beta Project");
      expect(res.body.projects[1].name).toBe("Alpha Project");
      expect(res.body.projects[0].pinned).toBe(false);
      expect(res.body.projects[0].state).toBe("active");
    });

    it("excludes projects owned by other users", async () => {
      const a = await signupAndLogin(httpServer, { username: "ownerA", email: "ownerA@example.com" });
      const b = await signupAndLogin(httpServer, { username: "ownerB", email: "ownerB@example.com" });
      await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${a}`)
        .send({ name: "Hidden From B", mode: "internal-events" });

      const res = await request(httpServer).get("/api/projects").set("Authorization", `Bearer ${b}`);
      expect(res.status).toBe(200);
      expect(res.body.projects).toEqual([]);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("renames a project owned by the acting user", async () => {
      const token = await signupAndLogin(httpServer, { username: "rn1", email: "rn1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Original Name", mode: "internal-events" });

      const res = await request(httpServer)
        .patch(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed Project" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Renamed Project");
    });

    it("toggles pinned and state in a single patch", async () => {
      const token = await signupAndLogin(httpServer, { username: "ps1", email: "ps1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Pin And Archive", mode: "internal-events" });

      const res = await request(httpServer)
        .patch(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ pinned: true, state: "archived" });
      expect(res.status).toBe(200);
      expect(res.body.pinned).toBe(true);
      expect(res.body.state).toBe("archived");
    });

    it("returns 400 when no mutable fields are provided", async () => {
      const token = await signupAndLogin(httpServer, { username: "empty1", email: "empty1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Empty Patch", mode: "internal-events" });
      const res = await request(httpServer)
        .patch(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown id", async () => {
      const token = await signupAndLogin(httpServer, { username: "missing1", email: "missing1@example.com" });
      const res = await request(httpServer)
        .patch("/api/projects/000000000000000000000000")
        .set("Authorization", `Bearer ${token}`)
        .send({ pinned: true });
      expect(res.status).toBe(404);
    });

    it("returns 403 when the project is not owned by the acting user", async () => {
      const owner = await signupAndLogin(httpServer, { username: "own1", email: "own1@example.com" });
      const intruder = await signupAndLogin(httpServer, { username: "intr1", email: "intr1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Owned By Someone", mode: "internal-events" });
      const res = await request(httpServer)
        .patch(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${intruder}`)
        .send({ pinned: true });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/projects/:id/duplicate", () => {
    it("creates a copy with ' (copy)' suffix and resets pinned + state", async () => {
      const token = await signupAndLogin(httpServer, { username: "dup1", email: "dup1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Master Project", mode: "internal-events" });
      await request(httpServer)
        .patch(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ pinned: true, state: "baseline" });

      const res = await request(httpServer)
        .post(`/api/projects/${created.body.id}/duplicate`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Master Project (copy)");
      expect(res.body.pinned).toBe(false);
      expect(res.body.state).toBe("active");
      expect(res.body.mode).toBe("internal-events");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("deletes a project owned by the user and removes it from /projects", async () => {
      const token = await signupAndLogin(httpServer, { username: "del1", email: "del1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "To Be Deleted", mode: "internal-events" });

      const res = await request(httpServer)
        .delete(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(204);

      const list = await request(httpServer).get("/api/projects").set("Authorization", `Bearer ${token}`);
      expect(list.body.projects.find((p: { id: string }) => p.id === created.body.id)).toBeUndefined();
    });

    it("returns 403 when a non-owner tries to delete", async () => {
      const owner = await signupAndLogin(httpServer, { username: "delown1", email: "delown1@example.com" });
      const intruder = await signupAndLogin(httpServer, { username: "delintr1", email: "delintr1@example.com" });
      const created = await request(httpServer)
        .post("/api/projects")
        .set("Authorization", `Bearer ${owner}`)
        .send({ name: "Protected Project", mode: "internal-events" });

      const res = await request(httpServer)
        .delete(`/api/projects/${created.body.id}`)
        .set("Authorization", `Bearer ${intruder}`);
      expect(res.status).toBe(403);
    });
  });
});
