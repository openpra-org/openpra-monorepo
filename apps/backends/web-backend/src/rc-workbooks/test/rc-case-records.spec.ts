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
  const values = (snapshotId: string, metricId = "RCM-01") => ({ snapshotId, metricId, statistics: metricId === "RCM-01" ? { mean: 0, percentiles: [{ percentile: 95, value: 0 }], exceedances: [] } : { mean: 12.5, percentiles: [], exceedances: [] },
    version: "test-only-build", reference: "test-only-calculation", confirmed: true });
  const families = [{ referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-test", entityId: "ESF-EARLY" }, { referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-test", entityId: "ESF-ATWS" }];
  const mapFamilies = () => t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.eventSequenceFamilyReferences": families } }).exec();
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
    expect(snapshot.reviewItems).toBeGreaterThan(0); expect(snapshot.metrics).toEqual([]); expect(snapshot.integrationSeconds).toBeUndefined(); expect(snapshot.inventoryCount).toBe(0);
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
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.values.inventory.0.activityBq": 123, "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.sourceTerm.revision": 3, "mef.scope.metrics.0.window.seconds": 1 }, $unset: { "mef.meteorologicalData.weatherInputs": 1 }, $inc: { __v: 1 } });
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
  it("records one result per category and metric and copies it to every mapped family", async () => {
    await seed(); await mapFamilies(); const a = (await save().expect(200)).body;
    expect(a.records.snapshots[0].metrics).toEqual([
      { id: "RCM-01", name: "Individual dose at boundary", quantity: "INDIVIDUAL_DOSE", windowSeconds: 2592000, unit: "Sv", statistics: { mean: true, percentiles: [95], exceedanceThresholds: [] } },
      { id: "RCM-02", name: "Population dose to 80 km", quantity: "POPULATION_DOSE", windowSeconds: 1577880000, unit: "person-Sv", statistics: { mean: true, percentiles: [], exceedanceThresholds: [] } },
    ]);
    expect(a.records.snapshots[0].versions).toBe(expectedVersions);
    const saved = (await result(a.records.revision, values(a.snapshotId)).expect(200)).body, r = saved.results[0];
    expect(r).toMatchObject({ categoryId: "RC-1", metricId: "RCM-01", unit: "Sv", statistics: values(a.snapshotId).statistics, valueSource: "transcribed", recordedBy: "preparer" });
    expect([...t.storage.values()].some(b => b.equals(output))).toBe(true);
    expect((await request(http()).get(`${url}/results/${r.id}/output`).expect(200)).body.text).toContain("TEST FIXTURE ONLY");
    await request(http()).delete(`${root}/documents/${r.file.documentId}`).expect(403);
    const mef = (await request(http()).get(root).expect(200)).body.mef;
    expect(mef.consequenceQuantification.caseRecords).toEqual(saved);
    expect(mef.consequenceQuantification.eventSequenceConsequences.map((row: { uuid: string; origin: string; releaseCategoryReference: string; consequenceResults: object[] }) => [row.uuid, row.origin, row.releaseCategoryReference, row.consequenceResults])).toEqual([
      ["RCQ-ESF-EARLY", "CATEGORY_RESULT", "RC-1", [{ metric: "Individual dose at boundary", meanValue: 0, unit: "Sv", uncertaintyDescription: "Mean 0 Sv · 95th percentile 0 Sv" }]],
      ["RCQ-ESF-ATWS", "CATEGORY_RESULT", "RC-1", [{ metric: "Individual dose at boundary", meanValue: 0, unit: "Sv", uncertaintyDescription: "Mean 0 Sv · 95th percentile 0 Sv" }]],
    ]);
    const second = (await result(saved.revision, values(a.snapshotId, "RCM-02")).expect(200)).body;
    const renamed = (await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["scope", "metrics", 1, "name"], value: "Collective dose" }] }).expect(200)).body.mef;
    expect(renamed.consequenceQuantification.eventSequenceConsequences[0].consequenceResults.map((row: { metric: string; meanValue: number }) => [row.metric, row.meanValue])).toEqual([["Individual dose at boundary", 0], ["Collective dose", 12.5]]);
    const stored = t.storage.size;
    const removed = (await request(http()).post(`${url}/results/${r.id}/remove`).send({ baseRevision: renamed.consequenceQuantification.caseRecords.revision }).expect(200)).body;
    expect(removed.results.map((row: { metricId: string }) => row.metricId)).toEqual(["RCM-02"]);
    expect(t.storage.size).toBe(stored - 1);
    await request(http()).post(`${url}/results/${r.id}/remove`).send({ baseRevision: removed.revision }).expect(404);
    const after = (await request(http()).get(root).expect(200)).body.mef;
    expect(after.consequenceQuantification.eventSequenceConsequences[0].consequenceResults.map((row: { metric: string }) => row.metric)).toEqual(["Collective dose"]);
  });
  it("keeps a hand-typed family override with its reason instead of the copied result", async () => {
    await seed(); await mapFamilies(); const a = (await save().expect(200)).body;
    await result(a.records.revision, values(a.snapshotId)).expect(200);
    const override = { uuid: "RCQ-ESF-ATWS", eventSequenceFamily: "ESF-ATWS", eventSequenceFamilyReference: families[1], releaseCategoryReference: "RC-1",
      consequenceResults: [{ metric: "Individual dose at boundary", meanValue: 0.002, unit: "Sv" }], origin: "OVERRIDE", overrideReason: "Separate run for this family." };
    const current = (await request(http()).get(root).expect(200)).body.mef.consequenceQuantification.eventSequenceConsequences;
    const next = (await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["consequenceQuantification", "eventSequenceConsequences"], value: [current[0], override] }] }).expect(200)).body.mef;
    expect(next.consequenceQuantification.eventSequenceConsequences.map((row: { uuid: string; origin: string }) => [row.uuid, row.origin])).toEqual([["RCQ-ESF-EARLY", "CATEGORY_RESULT"], ["RCQ-ESF-ATWS", "OVERRIDE"]]);
    const restored = (await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["consequenceQuantification", "eventSequenceConsequences"], value: [current[0]] }] }).expect(200)).body.mef;
    expect(restored.consequenceQuantification.eventSequenceConsequences.map((row: { uuid: string; origin: string }) => [row.uuid, row.origin])).toEqual([["RCQ-ESF-EARLY", "CATEGORY_RESULT"], ["RCQ-ESF-ATWS", "CATEGORY_RESULT"]]);
  });
  it("rejects results that miss or add statistics, forged IDs and unreadable output before storing bytes", async () => {
    await seed(); const a = (await save().expect(200)).body, good = values(a.snapshotId), count = t.storage.size;
    const statistics = good.statistics;
    for (const patch of [{ statistics: { ...statistics, mean: undefined } }, { statistics: { ...statistics, mean: -1 } }, { statistics: { ...statistics, percentiles: [] } },
      { statistics: { ...statistics, percentiles: [{ percentile: 95, value: 0 }, { percentile: 50, value: 0 }] } }, { statistics: { ...statistics, exceedances: [{ threshold: 0.001, probability: 0.1 }] } },
      { statistics: { ...statistics, exceedances: [{ threshold: 0.001, probability: 2 }] } }, { confirmed: false }, { version: " " }, { reference: "" }, { metricId: "" }, { metricId: "RCM-09" }, { snapshotId: "00000000-0000-4000-8000-000000000000" }, { dose: 0 }])
      await result(a.records.revision, { ...good, ...patch }).expect(patch.snapshotId ? 404 : 400);
    await result(a.records.revision, { ...values(a.snapshotId, "RCM-02"), statistics }).expect(400);
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
    const saved = (await result(a.records.revision, values(a.snapshotId)).expect(200)).body, id = saved.results[0].id;
    for (const user of ["reviewer", "viewer", "outsider"]) await request(http()).post(`${url}/results/${id}/remove`).set("x-test-user", user).send({ baseRevision: saved.revision }).expect(403);
    await request(http()).post(`${url}/results/${id}/remove`).send({ baseRevision: a.records.revision }).expect(409);
    await request(http()).get(`${url}/review`).query(selection(a.snapshotId)).set("x-test-user", "reviewer").expect(200);
    await request(http()).get(`${url}/text/structured`).query(selection(a.snapshotId)).set("x-test-user", "outsider").expect(403);
    await request(http()).get(`${url}/text/not-a-case-file`).query(selection(a.snapshotId)).expect(404);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await save(saved.revision).expect(403); await result(saved.revision, values(a.snapshotId)).expect(403);
    await request(http()).post(`${url}/results/${id}/remove`).send({ baseRevision: saved.revision }).expect(403);
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
