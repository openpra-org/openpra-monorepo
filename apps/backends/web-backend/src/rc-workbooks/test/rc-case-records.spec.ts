import request from "supertest";
import { createSourceTermTestApp } from "./source-term-test-app";
import { seedRcCase } from "./case-records-test-fixture";
import { caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";

describe("RC Step 08 case records", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  let expectedVersions = "";
  const root = "/rc-workbooks/rc-test", url = `${root}/case-records`, http = () => t.app.getHttpServer();
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { expectedVersions = caseVersions(currentRcCase(await t.reset(), "RC-1")); });
  const seed = async () => { const mef = await seedRcCase(t); expectedVersions = caseVersions(currentRcCase(mef, "RC-1")); return mef; };
  const save = (baseRevision = 0, versions = expectedVersions, user = "preparer") => request(http()).post(`${url}/snapshots`).set("x-test-user", user).send({ baseRevision, versions, categoryId: "RC-1" });
  const selection = (snapshotId?: string, versions = expectedVersions) => ({ categoryId: "RC-1", versions, ...(snapshotId ? { snapshotId } : {}) });
  // Deliberately synthetic, labeled test-only output; no claim that it is an OpenRC format.
  const output = Buffer.from("TEST FIXTURE ONLY\nmanual result record\nTEDE 0 mSv\n", "utf8");
  const values = (snapshotId: string) => ({ snapshotId, receptorId: "S01R01", trialId: "D001P01", dose: 0, unit: "mSv", version: "test-only-build", reference: "test-only-calculation", confirmed: true });
  const result = (revision: number, v: object, bytes = output, user = "preparer", filename = "test-only.out") => request(http()).post(`${url}/results`).set("x-test-user", user).field("record", JSON.stringify({ baseRevision: revision, result: v })).attach("file", bytes, filename);

  it("persists the new response model and carries its checks into a case snapshot", async () => {
    const model = { revision: 1, population: { source: "SITE_FILE", weighting: "PEOPLE" }, movement: { model: "NONE" }, iodineProtection: "OFF", cohorts: [] };
    const path = ["protectiveActionParameters", "earlyResponseModel"];
    const response = (await request(http()).patch(`${root}/early-response`).send({ baseRevision: 0, model }).expect(200)).body;
    const updated = (await request(http()).get(root).expect(200)).body.mef;
    expect(updated.protectiveActionParameters.earlyResponseModel).toEqual(response);
    const current = currentRcCase(updated, "RC-1");
    expect(current.response?.earlyResponseModel).toEqual(response);
    expectedVersions = caseVersions(current);
    const saved = (await save().expect(200)).body;
    expect(saved.records.snapshots[0].reviewItems).toBeGreaterThan(0);
    const snapshot = JSON.parse([...t.storage.values()][0].toString("utf8"));
    expect(snapshot.inputs.response.earlyResponseModel).toEqual(response);
    await request(http()).patch(`${root}/early-response`).send({ baseRevision: response.revision, model: { ...model, population: { source: "SITE_FILE", weighting: "INVALID" } } }).expect(400);
    await request(http()).patch(root).send({ operations: [{ op: "remove", path }] }).expect(409);
  });

  it("preserves incomplete cases and deduplicates identical snapshots without changing other sections", async () => {
    const mef = await t.reset(); expectedVersions = caseVersions(currentRcCase(mef, "RC-1")); const a = (await save().expect(200)).body;
    const snapshot = a.records.snapshots[0];
    expect(snapshot.reviewItems).toBeGreaterThan(0); expect(snapshot.integrationSeconds).toBeUndefined(); expect(snapshot.inventoryCount).toBe(0);
    const again = (await save(a.records.revision).expect(200)).body;
    expect(again).toEqual(a); expect(t.storage.size).toBe(1);
    const after = (await request(http()).get(root).expect(200)).body.mef;
    delete after.consequenceQuantification.caseRecords; expect(after).toEqual(mef);
    await request(http()).patch(root).send({ operations: [{ op: "remove", path: ["consequenceQuantification", "caseRecords"] }] }).expect(409);
  });
  it("pages authentic saved data and keeps missing release heights unspecified", async () => {
    await seed();
    const inventory = (await request(http()).get(`${url}/table/inventory`).query({ ...selection(), offset: 5 }).expect(200)).body;
    expect(inventory.total).toBe(69); expect(inventory.rows).toHaveLength(5); expect(inventory.offset).toBe(5);
    const releases = (await request(http()).get(`${url}/table/releases`).query(selection()).expect(200)).body;
    expect(releases.rows.every((r: any[]) => r[3] === 0)).toBe(true);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $unset: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.values.releases.0.heightMetres": 1 } });
    expect((await request(http()).get(`${url}/table/releases`).query(selection()).expect(200)).body.rows[0][3]).toBeNull();
    const receptors = (await request(http()).get(`${url}/table/receptors`).query({ ...selection(), offset: 14 }).expect(200)).body;
    expect(receptors.total).toBe(896); expect(receptors.rows[0][0]).toBe("S02R01");
    const weather = (await request(http()).get(`${url}/table/weather`).query(selection()).expect(200)).body;
    expect(weather.total).toBe(1); expect(weather.rows[0][0]).toBe("D001P01");
    expect(weather.units).toContain("probability weights");
    const text = (await request(http()).get(`${url}/text/structured`).query({ ...selection(), offset: 8 }).expect(200)).body;
    expect(text.offset).toBe(8); expect(text.text.split("\n")).toHaveLength(8);
    await request(http()).get(`${url}/table/receptors`).query({ ...selection(), offset: -1 }).expect(400);
    await request(http()).get(`${url}/table/__proto__`).query(selection()).expect(400);
  });
  it("retains immutable values, checks and originals after inputs change and through example restoration", async () => {
    const mef = await seed(), firstInventory = mef.releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm!.values.inventory[0].activityBq;
    const a = (await save().expect(200)).body, snapshotId = a.snapshotId;
    const before = (await request(http()).get(`${url}/review`).query(selection(snapshotId)).expect(200)).body;
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.values.inventory.0.activityBq": 123, "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.revision": 3, "mef.dosimetry.doseInputs.categories.0.settings.integrationSeconds": 1 }, $unset: { "mef.meteorologicalData.weatherInputs": 1 }, $inc: { __v: 1 } });
    const frozen = (await request(http()).get(`${url}/table/inventory`).query(selection(snapshotId)).expect(200)).body;
    expect(frozen.rows[0][1]).toBe(firstInventory);
    expect((await request(http()).get(`${url}/review`).query(selection(snapshotId)).expect(200)).body).toEqual(before);
    const sourceFile = before.files.find((f: any) => f.kind === "source");
    const original = (await request(http()).get(`${url}/text/${sourceFile.file.documentId}`).query(selection(snapshotId)).expect(200)).body;
    expect(original.text).toContain("MelMACCS");
    await request(http()).delete(`${root}/documents/${a.records.snapshots[0].file.documentId}`).expect(403);
    expect((await request(http()).get(`${root}/documents`).expect(200)).body).toEqual([]);
    await request(http()).post(`${root}/load-example`).send({}).expect(200); await request(http()).post(`${root}/unload-example`).send({}).expect(200);
    await request(http()).get(`${url}/table/weather`).query(selection(snapshotId)).expect(200);
    await request(http()).get(`${url}/text/structured`).query(selection(snapshotId)).expect(200);
  });
  it("links manually transcribed zero doses to immutable input IDs and duration", async () => {
    await seed(); const a = (await save().expect(200)).body;
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.dosimetry.doseInputs.categories.0.settings.integrationSeconds": 1 }, $inc: { __v: 1 } });
    const saved = (await result(a.records.revision, values(a.snapshotId)).expect(200)).body, r = saved.results[0];
    expect(r).toMatchObject({ dose: 0, unit: "mSv", valueSource: "transcribed", integrationSeconds: 2592000, recordedBy: "preparer" });
    expect([...t.storage.values()].some(b => b.equals(output))).toBe(true);
    expect((await request(http()).get(`${url}/results/${r.id}/output`).expect(200)).body.text).toContain("TEST FIXTURE ONLY");
    await request(http()).delete(`${root}/documents/${r.file.documentId}`).expect(403);
    const ids = (await request(http()).get(`${url}/snapshots/${a.snapshotId}/choices/receptors`).query({ search: "S02" }).expect(200)).body;
    expect(ids.total).toBe(14); expect(ids.ids[0]).toBe("S02R01");
    expect((await request(http()).get(root)).body.mef.consequenceQuantification.caseRecords).toEqual(saved);
  });
  it("rejects invalid result metadata, forged IDs, unreadable output and missing duration before storing bytes", async () => {
    await seed(); const a = (await save().expect(200)).body, good = values(a.snapshotId), count = t.storage.size;
    for (const patch of [{ dose: -1 }, { dose: "" }, { dose: null }, { confirmed: false }, { unit: "Gy" }, { version: " " }, { reference: "" }, { receptorId: "UNKNOWN" }, { trialId: "D999P99" }, { integrationSeconds: 99 }]) await result(a.records.revision, { ...good, ...patch }).expect(400);
    await result(a.records.revision, good, Buffer.from([0, 1, 2])).expect(400);
    await result(a.records.revision, good, Buffer.from("  \n")).expect(400);
    await result(a.records.revision, good, output, "preparer", "output.exe").expect(400);
    expect(t.storage.size).toBe(count);
    expectedVersions = caseVersions(currentRcCase(await t.reset(), "RC-1")); const b = (await save().expect(200)).body;
    await result(b.records.revision, values(b.snapshotId)).expect(400);
  });
  it("enforces access, review locks and current revisions for all writes", async () => {
    const mef = await seed(); expect(caseVersions(currentRcCase(mef, "RC-1"))).toMatch(/^1,1,1,0,1,\d+,\d+,\d+$/);
    for (const user of ["reviewer", "viewer", "outsider"]) await save(0, expectedVersions, user).expect(403);
    await save(0, "0,0,0,0,0,0,0,0").expect(409);
    const a = (await save().expect(200)).body;
    await save().expect(409);
    for (const user of ["reviewer", "viewer", "outsider"]) await result(a.records.revision, values(a.snapshotId), output, user).expect(403);
    await result(0, values(a.snapshotId)).expect(409);
    await request(http()).get(`${url}/review`).query(selection(a.snapshotId)).set("x-test-user", "reviewer").expect(200);
    await request(http()).get(`${url}/text/structured`).query(selection(a.snapshotId)).set("x-test-user", "outsider").expect(403);
    await request(http()).get(`${url}/text/not-a-case-file`).query(selection(a.snapshotId)).expect(404);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await save(a.records.revision).expect(403); await result(a.records.revision, values(a.snapshotId)).expect(403);
  });
  it("rolls back a new artifact when the workbook changes before persistence", async () => {
    await seed(); const real = t.documents.upload.bind(t.documents), count = t.storage.size;
    const spy = jest.spyOn(t.documents, "upload").mockImplementation(async (...args) => {
      const out = await real(...args); await t.workbooks.updateOne({ workbookId: "rc-test" }, { $inc: { __v: 1 } }); return out;
    });
    try { await save().expect(409); expect(t.storage.size).toBe(count); expect(await t.files.countDocuments({ caseArtifactOriginal: true })).toBe(0); }
    finally { spy.mockRestore(); }
  });
});
