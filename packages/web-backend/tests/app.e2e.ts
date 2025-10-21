import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { ApiModule } from "../src/api.module";

const baseUrl = process.env.BACKEND_BASE_URL ?? "http://localhost:8000/api";
const RUN_EXTERNAL = process.env.RUN_EXTERNAL_E2E === "true" || !!process.env.BACKEND_BASE_URL;

const maybeDescribe = RUN_EXTERNAL ? describe : describe.skip;

maybeDescribe("OpenPRA web-backend endpoints testing (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.UNSAFE_JWT_SECRET_KEY = process.env.UNSAFE_JWT_SECRET_KEY ?? "test-secret";
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  //request = request('http://localhost:8000/api');

  let jwttoken: string;

  describe("user login", () => {
    it("token-obtain", async () => {
  const res = await request(baseUrl).post("/auth/token-obtain/").send({
        username: "test2",
        password: "123456",
      });
      const body: { token?: string } = res.body as { token?: string };
      jwttoken = body.token ?? "";
      expect(res.status).toBe(200);
    });

    it("Get Model List", async () => {
      const res = await request(baseUrl)
        .get("/collab/model/?type=hcl")
        .set("Authorization", "JWT " + jwttoken);
      expect(res.status).toBe(200);
      type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
      const body = res.body as Paginated<unknown>;
      expect(body.count).toBe(0);
      expect(body.next).toBe(null);
      expect(body.previous).toBe(null);
      expect(body.results).toEqual([]);
    });
  });
});
