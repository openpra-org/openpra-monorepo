import request from "supertest";
import { createHash } from "crypto";
import type { ReleaseCategoryInputs, RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RcMefAdapter } from "../rc-mef-adapter";
import { createSourceTermTestApp, sourceFixture } from "./source-term-test-app";

describe("RC Step 01 source-term HTTP and storage", () => {
  let testApp: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  const url = "/rc-workbooks/rc-test", sourceUrl = `${url}/source-terms/RC-1`;
  beforeAll(async () => { testApp = await createSourceTermTestApp(); }, 120000);
  afterAll(async () => { await testApp?.close(); });
  beforeEach(async () => { await testApp.reset(); });
  const http = () => testApp.app.getHttpServer();
  const importSource = async (path = sourceUrl, revision = 0): Promise<ReleaseCategoryInputs> =>
    (await request(http()).post(`${path}/import`).field("baseRevision", String(revision)).attach("file", sourceFixture, "source.inp").expect(200)).body;
  const mef = async (): Promise<RadiologicalConsequenceAnalysis> => (await request(http()).get(url).expect(200)).body.mef;

  it("imports into the selected category, saves original bytes, and keeps existing narrative and the other category", async () => {
    const before = await mef(), category = await importSource();
    const source = category.sourceTerm!;
    expect(source.values.inventory).toHaveLength(69);
    expect(source.originalFile!.sha256).toBe(createHash("sha256").update(sourceFixture).digest("hex"));
    expect([...testApp.storage.values()][0]).toEqual(sourceFixture);
    expect(category.releaseCharacteristics.releaseUncertainties).toBe("Keep this existing basis");
    expect(category.releaseCharacteristics.releaseHeight).toBe(0);
    const after = await mef();
    expect(after.releaseCategoryToConsequence.releaseCategoryInputs[1]).toEqual(before.releaseCategoryToConsequence.releaseCategoryInputs[1]);
    expect(after.scope).toEqual(before.scope);
    expect(after.atmosphericTransportAndDispersion).toEqual(before.atmosphericTransportAndDispersion);
    await request(http()).get(`${url}/documents/${source.originalFile!.documentId}/download`).expect(200);
    expect((await request(http()).get(`${url}/documents`).expect(200)).body).toEqual([]);
    await request(http()).delete(`${url}/documents/${source.originalFile!.documentId}`).expect(403);
  });

  it("persists edited inventory, heights and fractions without changing the original file", async () => {
    const category = await importSource(), source = category.sourceTerm!;
    source.values.inventory[0].activityBq = 4e16;
    source.values.releases[0].heightMetres = 25;
    source.values.releases[0].fractions[1] = 0;
    const saved = await request(http()).patch(sourceUrl).send({ baseRevision: 1, values: source.values }).expect(200);
    const loaded = (await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0];
    expect(loaded).toEqual(saved.body);
    expect(loaded.sourceTerm!.revision).toBe(2);
    expect(loaded.sourceTerm!.values.inventory[0].activityBq).toBe(4e16);
    expect(loaded.releaseCharacteristics.releaseHeight).toBeUndefined();
    expect(loaded.releaseCharacteristics.releaseHeightDescription).toContain("25");
    expect([...testApp.storage.values()][0]).toEqual(sourceFixture);
  });

  it("saves manually entered source data without requiring a file", async () => {
    const values = { groups: [{ id: 1, name: "Cs" }], inventory: [{ name: "Cs-137", activityBq: 1e12, group: 1 }],
      releases: [{ id: 1, startSeconds: 60, durationSeconds: 3600, heightMetres: 10, fractions: [0.01] }] };
    const saved = await request(http()).patch(`${url}/source-terms/RC-2`).send({ baseRevision: 0, values }).expect(200);
    expect(saved.body.sourceTerm.values).toEqual(values);
    expect(saved.body.sourceTerm.originalFile).toBeUndefined();
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[1]).toEqual(saved.body);
    expect(await testApp.files.countDocuments()).toBe(0);
  });

  it("rejects a draft from an earlier category after an example replaces its inputs", async () => {
    const original = await importSource();
    await request(http()).post(`${url}/load-example`).send({}).expect(200);
    await request(http()).patch(url).send({ operations: [{ op: "add", path: ["releaseCategoryToConsequence", "releaseCategoryInputs", 0],
      value: { releaseCategory: "RC-1", releaseCharacteristics: {} } }] }).expect(200);
    const replacement = await importSource();
    expect(replacement.sourceTerm!.revision).toBeGreaterThan(original.sourceTerm!.revision);
    await request(http()).patch(sourceUrl).send({ baseRevision: original.sourceTerm!.revision, values: original.sourceTerm!.values }).expect(409);
  });

  it("preserves missing heights through Mongo and later supplies an explicit zero", async () => {
    const raw = Buffer.from(sourceFixture.toString().replace(/^RDPLHITE001.*\r?\n/m, ""));
    await request(http()).post(`${sourceUrl}/import`).field("baseRevision", "0").attach("file", raw, "missing.inp").expect(200);
    const source = (await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm!;
    expect(source.values.releases[0].heightMetres).toBeUndefined();
    source.values.releases[0].heightMetres = 0;
    await request(http()).patch(sourceUrl).send({ baseRevision: 1, values: source.values }).expect(200);
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0].releaseCharacteristics.releaseHeight).toBe(0);
  });

  it("rejects invalid imports and edits without replacing saved data", async () => {
    const category = await importSource();
    await request(http()).post(`${sourceUrl}/import`).field("baseRevision", "1").attach("file", Buffer.from("invalid"), "bad.inp").expect(400);
    const values = structuredClone(category.sourceTerm!.values);
    values.inventory[0].activityBq = -1;
    await request(http()).patch(sourceUrl).send({ baseRevision: 1, values }).expect(400);
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0]).toEqual(category);
    expect(await testApp.files.countDocuments()).toBe(1);
  });

  it("rejects concurrent and stale source saves and stale review actions", async () => {
    const adapter = testApp.app.get(RcMefAdapter), oldReview = await adapter.load("rc-test");
    const category = await importSource(), body = { baseRevision: 1, values: category.sourceTerm!.values };
    const results = await Promise.all([request(http()).patch(sourceUrl).send(body), request(http()).patch(sourceUrl).send(body)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    await request(http()).patch(sourceUrl).send(body).expect(409);
    await expect(adapter.save("rc-test", oldReview!.mef, oldReview!.revision)).rejects.toThrow("changed");
  });

  it("keeps source data through unrelated autosaves and rejects attempts to forge it", async () => {
    const category = await importSource();
    await request(http()).patch(url).send({ operations: [{ op: "replace", path: ["praScope"], value: "Updated scope" }] }).expect(200);
    await request(http()).patch(url).send({ operations: [{ op: "replace", path: ["releaseCategoryToConsequence", "releaseCategoryInputs", 0, "sourceTerm", "values", "inventory", 0, "activityBq"], value: 50 }] }).expect(409);
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0]).toEqual(category);
  });

  it("removes an unlinked upload after a conflicting import", async () => {
    const category = await importSource();
    const fail = jest.spyOn(testApp.workbooks, "updateOne").mockReturnValueOnce({ exec: async () => ({ modifiedCount: 0 }) } as unknown as ReturnType<typeof testApp.workbooks.updateOne>);
    try {
      await request(http()).post(`${sourceUrl}/import`).field("baseRevision", "1").attach("file", sourceFixture, "retry.inp").expect(409);
    } finally { fail.mockRestore(); }
    expect(await testApp.files.countDocuments()).toBe(1);
    expect(testApp.storage.size).toBe(1);
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0]).toEqual(category);
  });

  it("restores the source and its original after loading and unloading an example", async () => {
    const category = await importSource();
    await request(http()).post(`${url}/load-example`).send({}).expect(200);
    await request(http()).post(`${url}/unload-example`).send({}).expect(200);
    expect((await mef()).releaseCategoryToConsequence.releaseCategoryInputs[0]).toEqual(category);
    expect([...testApp.storage.values()][0]).toEqual(sourceFixture);
    await request(http()).get(`${url}/documents/${category.sourceTerm!.originalFile!.documentId}/download`).expect(200);
  });

  it.each(["reviewer", "approver", "viewer", "outsider"])("denies mutations by %s", async (username) => {
    const category = await importSource();
    await request(http()).post(`${sourceUrl}/import`).set("x-test-user", username).field("baseRevision", "1").attach("file", sourceFixture, "file.inp").expect(403);
    await request(http()).patch(sourceUrl).set("x-test-user", username).send({ baseRevision: 1, values: category.sourceTerm!.values }).expect(403);
    expect(await testApp.files.countDocuments()).toBe(1);
  });

  it("allows review reads and rejects locked source changes", async () => {
    const category = await importSource();
    await testApp.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "INTERNAL_APPROVAL" } }).exec();
    await request(http()).get(url).set("x-test-user", "reviewer").expect(200);
    await request(http()).patch(sourceUrl).send({ baseRevision: 1, values: category.sourceTerm!.values }).expect(403);
    await request(http()).post(`${sourceUrl}/import`).field("baseRevision", "1").attach("file", sourceFixture, "file.inp").expect(403);
  });
});
