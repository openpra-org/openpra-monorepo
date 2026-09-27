import request from "supertest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createSourceTermTestApp } from "./source-term-test-app";

const published = readFileSync(resolve(__dirname, "../../../example-documents/RC-Published-Inputs/MACCS-Noah-response-settings-excerpt.inp"));
describe("Early response import and editing", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); });
  const upload = (revision = 0, user = "preparer", file = published) => request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/early-response/import")
    .set("x-test-user", user).field("baseRevision", String(revision)).attach("file", file, "response.inp");
  it("imports the published records, retains the original and saves analyst choices", async () => {
    const model = (await upload().expect(200)).body;
    expect(model.cohorts).toHaveLength(3);
    expect(model.population.weighting).toBe("UNSET");
    expect((await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/early-response/files/${model.originalFile.documentId}`).expect(200)).body.text).toBe(published.toString("utf8"));
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/documents").expect(200)).body).toEqual([]);
    await request(t.app.getHttpServer()).delete(`/rc-workbooks/rc-test/documents/${model.originalFile.documentId}`).expect(403);
    model.population.weighting = "TIME";
    const saved = (await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/early-response").send({ baseRevision: model.revision, model }).expect(200)).body;
    expect(saved.population.weighting).toBe("TIME");
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200)).body.mef.protectiveActionParameters.earlyResponseModel).toEqual(saved);
  });
  it("rejects stale revisions, forged provenance, bad files and unprivileged writes", async () => {
    await upload(0, "reviewer").expect(403);
    await upload(0, "preparer", Buffer.from("not response inputs")).expect(400);
    const model = (await upload().expect(200)).body;
    await upload(0).expect(409);
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/early-response").send({ baseRevision: model.revision, model: { ...model, originalFile: { ...model.originalFile, documentId: "forged" } } }).expect(400);
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test").send({ operations: [{ op: "remove", path: ["protectiveActionParameters", "earlyResponseModel"] }] }).expect(409);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await upload(model.revision).expect(403);
  });
  it("imports a full structured response model without trusting embedded provenance", async () => {
    const model = { revision: 42, population: { source: "UNIFORM", weighting: "PEOPLE", uniform: { firstPopulatedBand: 1, densityPeoplePerSquareKm: 100, landFraction: 1 } },
      movement: { model: "NONE" }, iodineProtection: "OFF", cohorts: [], originalFile: { documentId: "foreign", filename: "foreign.inp", size: 1, sha256: "x", uploadedAt: "now" } };
    const imported = (await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/early-response/import").field("baseRevision", "0")
      .attach("file", Buffer.from(JSON.stringify(model)), "model.json").expect(200)).body;
    expect(imported.population).toEqual(model.population);
    expect(imported.originalFile.filename).toBe("model.json");
    expect(imported.originalFile.documentId).not.toBe("foreign");
    await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/early-response/import").field("baseRevision", String(imported.revision))
      .attach("file", Buffer.from(JSON.stringify({ cohorts: [] })), "bad.json").expect(400);
  });
  it("calculates protected dose over the chosen metric exposure window", async () => {
    const factors = { cloudshineFactor: 0.5, inhalationFactor: 1, groundshineFactor: 1, skinFactor: 1, breathingRateCubicMetresPerSecond: 0.0002 };
    const model = { revision: 1, earlyPhaseDurationSeconds: 1000, fineGridAzimuthSubdivisions: 3,
      population: { source: "SITE_FILE", weighting: "PEOPLE" }, movement: { model: "NONE" }, iodineProtection: "OFF",
      cohorts: [{ id: "A", name: "Residents", resultWeightFraction: 1, criticalOrgan: "Effective",
        evacuation: { shape: "NONE" }, exposure: { normal: factors, projected: factors } }],
      relocation: { projectionMode: "TOTAL", projectionPeriodSeconds: 100,
        normal: { actionDelaySeconds: 100, thresholdSv: 0.1 }, hotSpot: { actionDelaySeconds: 50, thresholdSv: 1 } } };
    const metric = (id: string, start: string, protectiveActionsCredited = true) => ({ id, name: id, quantity: "INDIVIDUAL_DOSE", receptor: { kind: "EAB_MAXIMUM" },
      window: { seconds: 60, start }, protectiveActionsCredited, statistics: { mean: true, percentiles: [], exceedanceThresholds: [] }, criterion: "Test criterion", basis: "Test basis" });
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: {
      "mef.scope.metrics": [metric("RCM-01", "RELEASE_ONSET"), metric("RCM-02", "PLUME_ARRIVAL"), metric("RCM-03", "RELEASE_ONSET", false)],
      "mef.protectiveActionParameters.earlyResponseModel": model,
      "mef.protectiveActionParameters.siteAndReceptors": { revision: 1, settings: {}, geometry: { kind: "cells", radiiKm: [1], sectors: 1, abridged: false, populationByCell: [100] } },
      "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm": { revision: 1, values: { groups: [], inventory: [], releases: [{ id: 1, startSeconds: 0, fractions: [] }] } },
      "mef.dosimetry.doseInputs": { revision: 1, libraries: [], categories: [{ categoryId: "RC-1", savedForSourceRevision: 1 }] },
    } });
    const input = { originCellIndex: 0, targetOrgan: "Effective", plumeArrivalSecondsByCell: [20], projectedDoseSvByCohort: { A: 0 },
      referenceBreathingRateCubicMetresPerSecond: 0.0002,
      doseRates: [{ cellIndex: 0, startSeconds: 0, endSeconds: 100, organ: "Effective", cloudshineSvPerSecond: 0.001,
        inhalationSvPerSecond: 0, groundshineSvPerSecond: 0, skinSvPerSecond: 0 }] };
    const send = (content: unknown, metricId = "RCM-01", user = "viewer") => request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/early-response/calculate")
      .set("x-test-user", user).field("categoryId", "RC-1").field("metricId", metricId).attach("file", Buffer.from(JSON.stringify(content)), "rates.json");
    const result = (await send(input).expect(200)).body;
    expect(result.issues).toEqual([]);
    expect(result.cohorts[0].population).toBe(100);
    expect(result.cohorts[0].doseSv.total).toBeCloseTo(0.03);
    expect((await send(input, "RCM-02").expect(200)).body.cohorts[0].doseSv.total).toBeCloseTo(0.04);
    await send(input, "RCM-03").expect(400); await send(input, "RCM-09").expect(400);
    await send({ ...input, integrationSeconds: 1 }).expect(400);
    await send(input, "RCM-01", "outsider").expect(403);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $unset: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.values.releases.0.startSeconds": 1 } });
    await send(input).expect(400);
    expect((await send(input, "RCM-02").expect(200)).body.cohorts[0].doseSv.total).toBeCloseTo(0.04);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.dosimetry.doseInputs.categories.0.savedForSourceRevision": 2 } });
    await send(input, "RCM-02").expect(400);
  });
});
