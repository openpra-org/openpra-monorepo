import request from "supertest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createSourceTermTestApp } from "./source-term-test-app";

const fixture = (name: string) => readFileSync(resolve(__dirname, "../../../../../interfaces/shared-types/rc-workbooks/test/fixtures", name));
const secpop = fixture("SecPop-Noah-published-site-excerpt.txt"), grid = fixture("AERMAP_NAD27_DEM.REC");
describe("Site and receptor persistence", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); });
  const upload = (revision = 0, bytes = secpop, user = "preparer", kind = "geometry") => request(t.app.getHttpServer()).post(`/rc-workbooks/rc-test/site-receptors/import/${kind}`).set("x-test-user", user).field("baseRevision", String(revision)).attach("file", bytes, "input.txt");
  it("retains original bytes and persists settings with an evaluated 896-cell output", async () => {
    const imported = await upload().expect(200), site = imported.body;
    expect(site.settings).toEqual({ latitude: 35.310276, longitude: -93.23194 });
    const original = await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/site-receptors/files/${site.geometryFile.documentId}`).expect(200);
    expect(original.body.text).toBe(secpop.toString("utf8"));
    expect((await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/documents").expect(200)).body).toEqual([]);
    await request(t.app.getHttpServer()).delete(`/rc-workbooks/rc-test/documents/${site.geometryFile.documentId}`).expect(403);
    const saved = await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/site-receptors").send({ baseRevision: site.revision, settings: { ...site.settings, cellPoint: "mid", receptorHeightMetres: 1.5 } }).expect(200);
    const points = await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/site-receptors/points?offset=457&limit=1").expect(200);
    expect(points.body).toMatchObject({ total: 896, revision: saved.body.revision, points: [{ id: "S33R10", distanceMetres: 36210.25, heightMetres: 1.5 }] });
    const reloaded = await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200);
    expect(reloaded.body.mef.protectiveActionParameters.siteAndReceptors).toEqual(saved.body);
  });
  it("rejects stale updates, forged file metadata, malformed files, and unprivileged writes", async () => {
    await upload(0, secpop, "reviewer").expect(403); await upload(0, secpop, "outsider").expect(403);
    await upload(0, Buffer.from("not geometry")).expect(400); expect(t.storage.size).toBe(0);
    const site = (await upload().expect(200)).body;
    await upload(0, grid).expect(409);
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/site-receptors").send({ baseRevision: site.revision, settings: {}, geometryFile: site.geometryFile }).expect(400);
    await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test").send({ operations: [{ op: "remove", path: ["protectiveActionParameters", "siteAndReceptors"] }] }).expect(409);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await upload(site.revision, grid).expect(403);
  });
  it("requires explicit missing heights, keeps manual location, and restores originals after example loading", async () => {
    const imported = (await upload().expect(200)).body;
    const saved = (await request(t.app.getHttpServer()).patch("/rc-workbooks/rc-test/site-receptors").send({ baseRevision: imported.revision, settings: { latitude: 36, longitude: -90 } }).expect(200)).body;
    const next = (await upload(saved.revision, grid).expect(200)).body;
    expect(next.settings).toEqual({ latitude: 36, longitude: -90 }); expect(next.geometry.points[0].heightMetres).toBeUndefined();
    await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test/site-receptors/points").expect(400);
    await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/load-example").send({}).expect(200);
    await request(t.app.getHttpServer()).post("/rc-workbooks/rc-test/unload-example").send({}).expect(200);
    const restored = (await request(t.app.getHttpServer()).get("/rc-workbooks/rc-test").expect(200)).body.mef.protectiveActionParameters.siteAndReceptors;
    expect(restored).toEqual(next);
    expect((await request(t.app.getHttpServer()).get(`/rc-workbooks/rc-test/site-receptors/files/${restored.geometryFile.documentId}`).expect(200)).body.text).toBe(grid.toString("utf8"));
  });
});
