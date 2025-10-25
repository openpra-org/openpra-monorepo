import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import mongoose from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";
import { GraphModelModule } from "../src/graphModels/graphModel.module";

// This e2e test boots a lightweight Nest app with the GraphModelModule
// and exercises the HTTP endpoints using supertest. It relies on tests/unitTestSetup
// to provide process.env.MONGO_URI (mongodb-memory-server or local Mongo).

describe("GraphModel HTTP endpoints (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI as string;
    if (!mongoUri) throw new Error("MONGO_URI must be set by unitTestSetup");

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoUri), GraphModelModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
  });

  it("GET /fault-tree-graph/ returns empty graph when not found", async () => {
    const res = await request(app.getHttpServer()).get("/fault-tree-graph/").query({ faultTreeId: "nonexistent" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });

  it("POST /fault-tree-graph and then GET returns the posted graph", async () => {
    const payload = {
      faultTreeId: "ft-1",
      nodes: [
        { id: "1", type: "orGate", position: { x: 0, y: 0 }, data: { label: "OR" } },
        { id: "2", type: "basicEvent", position: { x: -50, y: 100 }, data: { label: "A" } },
        { id: "3", type: "basicEvent", position: { x: 50, y: 100 }, data: { label: "B" } },
      ],
      edges: [
        { id: "1->2", type: "workflow", source: "1", target: "2", data: {}, animated: false },
        { id: "1->3", type: "workflow", source: "1", target: "3", data: {}, animated: false },
      ],
    };

    const postRes = await request(app.getHttpServer()).post("/fault-tree-graph").send(payload);
    expect(postRes.status).toBe(201); // Created
    // Controller returns boolean; Nest maps true to 201 with no body

    const getRes = await request(app.getHttpServer()).get("/fault-tree-graph/").query({ faultTreeId: "ft-1" });
    expect(getRes.status).toBe(200);
    const body = getRes.body as {
      nodes: Array<{ id: string; type: string }>;
      edges: Array<{ id: string; source: string; target: string; type: string }>;
    };
    expect(body.nodes.map((n) => ({ id: n.id, type: n.type }))).toEqual([
      { id: "1", type: "orGate" },
      { id: "2", type: "basicEvent" },
      { id: "3", type: "basicEvent" },
    ]);
    expect(body.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))).toEqual([
      { id: "1->2", source: "1", target: "2", type: "workflow" },
      { id: "1->3", source: "1", target: "3", type: "workflow" },
    ]);
  });

  it("POST empty fault tree then GET returns default-seeded graph", async () => {
    const payload = {
      faultTreeId: "ft-default-seed",
      nodes: [],
      edges: [],
    };

    const postRes = await request(app.getHttpServer()).post("/fault-tree-graph").send(payload);
    expect(postRes.status).toBe(201);

    const getRes = await request(app.getHttpServer())
      .get("/fault-tree-graph/")
      .query({ faultTreeId: "ft-default-seed" });
    expect(getRes.status).toBe(200);
    const body = getRes.body as {
      nodes: Array<{ id: string; type: string; data?: { label?: string } }>;
      edges: Array<{ id: string; source: string; target: string; type: string }>;
    };
    // default graph should have 3 nodes and 2 edges: OR gate + 2 basic events
    expect(body.nodes.length).toBe(3);
    expect(body.edges.length).toBe(2);
    // Verify presence of OR gate and basic events
    const types = body.nodes.map((n) => n.type).sort();
    expect(types).toEqual(["basicEvent", "basicEvent", "orGate"].sort());
    const edgePairs = body.edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(edgePairs).toEqual(["1->2", "1->3"].sort());
  });
});
