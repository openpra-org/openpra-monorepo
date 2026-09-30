import request from "supertest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createSourceTermTestApp } from "./source-term-test-app";

const fixture = (name: string) => readFileSync(resolve(__dirname, "../../../../../interfaces/shared-types/rc-workbooks/test/fixtures", name));
const met = fixture("MacMetGen-Noah-published-day.MET"), config = fixture("MacMetGen-Noah-published-config.inp");
describe("RC weather persistence", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); });
  const upload = (revision = 0, kind = "weather", bytes = met, user = "preparer") => request(t.app.getHttpServer()).post(`/rc-workbooks/rc-test/weather/import/${kind}`).set("x-test-user", user).field("baseRevision", String(revision)).attach("file", bytes, "input.txt");
  const save = (baseRevision: number, settings: object, model: object, confirm = false) => request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/weather").send({ baseRevision, settings, model, confirm });
  const setup = async () => {
    const imported = (await upload().expect(200)).body;
    return (await upload(imported.revision, "configuration", config).expect(200)).body;
  };
  const site = async (latitude = 35.31028) => (await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/site-receptors").send({ baseRevision: 0, settings: { latitude, longitude: -93.23194 } }).expect(200)).body;
  it("imports and pages real records, protects original files, and persists the analyst review", async () => {
    await site(); const w = await setup();
    const analysis = (await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200)).body.mef.meteorologicalData;
    expect(analysis).toMatchObject({ dataSource: "input.txt", timeResolution: "60 min",
      dataRecovery: { meetsNinetyPercent: false },
      extractedParameters: { windSpeedAndDirection10m: true, stabilityClassMeasurement: true, precipitation: true },
      periodSelection: { periodDescription: "2020-01-01 to 2020-12-31" },
      stabilityClassificationMethod: { approach: "RECOGNIZED_SOURCE", description: "Solar radiation and temperature gradient · input.txt" } });
    expect(analysis.dataRecovery.combinedRecoveryPercent).toBeCloseTo(24 / (365 * 24) * 100);
    expect((await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/weather/files/${w.weatherFile.documentId}`).expect(200)).body.text).toBe(met.toString("utf8"));
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/documents").expect(200)).body).toEqual([]);
    await request(t.app.getHttpServer()).delete(`/rc-workbooks/rc-test/documents/${w.weatherFile.documentId}`).expect(403);
    const rows = (await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/weather/records?offset=18&limit=6").expect(200)).body;
    expect(rows).toMatchObject({ total: 24, offset: 18 }); expect(rows.records[5]).toMatchObject({ windSpeedMetresPerSecond: 3.7, stabilityClass: "D" });
    await save(w.revision, w.settings, w.model, true).expect(400);
    const saved = (await save(w.revision, { ...w.settings, nearbySite: { latitude: 35.31028, longitude: -93.23194 } }, w.model, true).expect(200)).body;
    expect(saved.review).toMatchObject({ reviewedBy: "preparer", latitude: 35.31028 });
    expect(saved.trialSet).toMatchObject({ mode: "fixed_start", trialCount: 1, probabilityTotal: 1 });
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/weather/trials").expect(200)).body.trials[0]).toMatchObject({ id: "D001P01", probability: 1 });
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200)).body.mef.meteorologicalData.weatherInputs).toEqual(saved);
  });
  it("rejects unauthorized, stale, malformed and forged inputs without losing saved weather", async () => {
    await upload(0, "weather", met, "reviewer").expect(403); await upload(0, "weather", met, "outsider").expect(403);
    await upload(0, "weather", Buffer.from("bad data")).expect(400); expect(t.storage.size).toBe(0);
    const w = await setup(); await upload(0).expect(409);
    await save(w.revision, { ...w.settings, year: 2021 }, w.model).expect(400);
    await save(w.revision, { ...w.settings, windSectors: 32 }, w.model).expect(400);
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test").send({ operations: [{ op: "remove", path: ["meteorologicalData", "weatherInputs"] }] }).expect(409);
    await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/weather/files/${w.weatherFile.documentId}`).set("x-test-user", "outsider").expect(403);
    await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/weather/records?offset=-1").expect(400);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await save(w.revision, w.settings, w.model).expect(403);
  });
  it("prepares a collection request from saved site coordinates without claiming a retrieval", async () => {
    const s = await site();
    const prepare = (siteRevision: number, start: string) => request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/weather/collection-request").send({ baseRevision: 0, siteRevision, dates: { start, end: "2020-01-31" } });
    await prepare(0, "2020-01-01").expect(409); await prepare(s.revision, "2020-02-30").expect(400);
    const w = (await prepare(s.revision, "2020-01-01").expect(200)).body;
    expect(w.collectionRequest).toMatchObject({ status: "prepared", latitude: 35.31028, longitude: -93.23194, start: "2020-01-01", end: "2020-01-31" });
    expect(w.data).toBeUndefined(); expect(w.weatherFile).toBeUndefined(); expect(w.review).toBeUndefined();
  });
  it("resets metadata on weather replacement and retains originals through example loading", async () => {
    const w = await setup(), replacement = (await upload(w.revision).expect(200)).body;
    expect(replacement.configuration).toBeUndefined(); expect(replacement.settings).toEqual({});
    await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/load-example").send({}).expect(200);
    await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/unload-example").send({}).expect(200);
    expect((await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/weather/files/${replacement.weatherFile.documentId}`).expect(200)).body.text).toBe(met.toString("utf8"));
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200)).body.mef.meteorologicalData.weatherInputs).toEqual(replacement);
  });
  it("allows a fresh review when the site moves onto the weather location", async () => {
    const s = await site(), w = await setup();
    const reviewed = (await save(w.revision, { ...w.settings, nearbySite: s.settings }, w.model, true).expect(200)).body;
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/site-receptors").send({ baseRevision: s.revision, settings: { latitude: w.settings.latitude, longitude: w.settings.longitude } }).expect(200);
    const next = (await save(reviewed.revision, reviewed.settings, reviewed.model, true).expect(200)).body;
    expect(next.settings.nearbySite).toBeUndefined();
    expect(next.review).toMatchObject({ latitude: w.settings.latitude, longitude: w.settings.longitude });
  });
});
