import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { BayesianNetworkBuilderResponseSchema } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { JwtAuthGuard } from "../../../../auth/jwt-auth.guard";
import { NetworkBuilderController } from "../network-builder.controller";
import { NetworkBuilderService } from "../network-builder.service";

const SOURCE = [
  'schema_version: "0.1"',
  "model:",
  "  id: http_case",
  "  description: http case",
  "discretization:",
  "  PGA:",
  "    states: [PGA_1, PGA_2]",
  "    centers: [0.2, 0.6]",
  "builders:",
  "  - type: seismic",
  "    pga_probs: [0.9, 0.1]",
  "    sscs:",
  "      - ssc_id: DG_A",
  "        theta: 0.6",
  "        beta: 0.4",
  "",
].join("\n");

const createApplication = async (allowed: boolean): Promise<INestApplication> => {
  const moduleReference = await Test.createTestingModule({
    controllers: [NetworkBuilderController],
    providers: [NetworkBuilderService],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => allowed })
    .compile();
  const application = moduleReference.createNestApplication();
  await application.init();
  return application;
};

describe("POST /bayesian-network/network-builder", () => {
  let application: INestApplication;

  afterEach(async () => {
    await application.close();
  });

  it("returns a network file for a valid specification", async () => {
    application = await createApplication(true);
    const response = await request(application.getHttpServer())
      .post("/bayesian-network/network-builder")
      .send({ format: "YAML", source: SOURCE });
    expect(response.status).toBe(200);
    const body = BayesianNetworkBuilderResponseSchema.parse(response.body);
    expect(body.modelId).toBe("http_case");
    expect(body.nodeCount).toBe(2);
    expect(body.networkFile).toContain('<cpt id="SEISMIC_FAIL_DG_A">');
  });

  it("answers 400 with the builder message for an invalid specification", async () => {
    application = await createApplication(true);
    const response = await request(application.getHttpServer())
      .post("/bayesian-network/network-builder")
      .send({ format: "YAML", source: SOURCE.split("pga_probs: [0.9, 0.1]").join("pga_probs: [0.9, 0.2]") });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("pga_probs must sum to 1.0 (got 1.1).");
  });

  it("answers 400 for a malformed request", async () => {
    application = await createApplication(true);
    const response = await request(application.getHttpServer())
      .post("/bayesian-network/network-builder")
      .send({ format: "XML", source: "x" });
    expect(response.status).toBe(400);
  });

  it("refuses a request the guard rejects", async () => {
    application = await createApplication(false);
    const response = await request(application.getHttpServer())
      .post("/bayesian-network/network-builder")
      .send({ format: "YAML", source: SOURCE });
    expect(response.status).toBe(403);
  });
});
