import request from "supertest";
import { Test } from "@nestjs/testing";
import { createHash } from "crypto";
import { createSourceTermTestApp } from "./source-term-test-app";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { ExampleDocumentsController } from "../../example-workbooks/example-documents.controller";
import { createPublishedRcSeed, RC_PUBLISHED_ID, RC_PUBLISHED_LABEL, RC_PUBLISHED_SLUG, RC_PUBLISHED_CATEGORY, RC_PUBLISHED_FILES, readRcPublishedFile } from "../../example-workbooks/seeds/rc-published-inputs-seed";
import { RC_EXAMPLES, SEEDS } from "../../example-workbooks/seeds";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { caseFiles, caseTable, caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { caseChecks } from "interfaces-shared-types/rc-workbooks/case-records";
import { doseCoverage } from "interfaces-shared-types/rc-workbooks/dose-inputs";

describe("RC-only published input example", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  const root = "/rc-workbooks/rc-test", http = () => t.app.getHttpServer();
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => { await t.reset(); jest.spyOn(t.app.get(ExampleWorkbooksService), "getRcBundle").mockResolvedValue({ rc: { slug: RC_PUBLISHED_SLUG, kind: "RC", mef: createPublishedRcSeed(), updatedAt: "2026-09-12T00:00:00Z" }, configurationControl: {} as any, newlyDevelopedMethods: [] }); });
  afterEach(() => { jest.restoreAllMocks(); });
  const load = (user = "preparer") => request(http()).post(`${root}/load-example`).set("x-test-user", user).send({ example: RC_PUBLISHED_ID });
  it("registers one new RC option and validates authentic numerical inputs", () => {
    expect(RC_EXAMPLES.find(e => e.id === RC_PUBLISHED_ID)).toEqual({ id: RC_PUBLISHED_ID, label: RC_PUBLISHED_LABEL, slug: RC_PUBLISHED_SLUG });
    expect(RC_EXAMPLES[0].id).toBe("htgr");
    expect(SEEDS.filter(s => s.slug === RC_PUBLISHED_SLUG).map(s => s.kind)).toEqual(["RC"]);
    const rc = createPublishedRcSeed(); expect(RadiologicalConsequenceAnalysisSchema.safeParse(rc).success).toBe(true);
    const c = currentRcCase(rc, RC_PUBLISHED_CATEGORY), source = c.source!.values;
    expect(source.inventory).toHaveLength(69); expect(source.groups).toHaveLength(10); expect(source.releases).toHaveLength(8);
    expect(source.inventory[0]).toEqual({ name: "Kr-85", activityBq: 3.6319e16, group: 1 });
    expect(source.releases.every(s => s.heightMetres === 0)).toBe(true);
    expect(c.site!.settings).toEqual({ latitude: 35.31028, longitude: -93.23194 });
    expect(c.site!.geometry).toMatchObject({ kind: "cells", sectors: 64, abridged: true });
    expect(c.site!.geometry!.kind === "cells" && c.site!.geometry!.radiiKm.length).toBe(14);
    expect(c.response!.cohortModeling.cohorts!.map(group => group.name)).toEqual(["90th Percentile Evacuation Cohort", "100th Percentile Evacuation Cohort", "Non-Evacuating Cohort"]);
    expect(c.response!.cohortModeling.cohorts!.every(group => group.populationPercent === undefined && group.compliancePercent === undefined)).toBe(true);
    expect(c.response!.responseTiming).toMatchObject({ cohortName: "90th Percentile Evacuation Cohort", referenceEvent: "Off-site alarm", referenceAfterAccidentMinutes: 45,
      shelterStartMinutes: 33, evacuationStartMinutes: 183, evacuationSpeedMetresPerSecond: 1.8 });
    const responseRows = caseTable(c, "response", 0).rows;
    expect(responseRows[0].slice(5)).toEqual([78, 228, 1.8]);
    expect(responseRows[1].slice(5)).toEqual([null, null, null]);
    expect(c.weather!.settings).toEqual({ latitude: 35.2989, longitude: -93.2422, year: 2020, windSectors: 64 });
    expect(c.weather!.data!.recordCount).toBe(24); expect(c.weather!.trialSet).toMatchObject({ mode: "fixed_start", trialCount: 1, probabilityTotal: 1 }); expect(c.weather!.review).toBeUndefined();
    expect(c.dose!.categories[0].settings!.integrationSeconds).toBe(2592000);
    expect(doseCoverage(c.dose, source, "inhalation").found).toHaveLength(58);
    expect(doseCoverage(c.dose, source, "cloudshine").found).toHaveLength(69);
    expect(rc.healthEffects.healthInput?.filename).toBe("MACCS-Noah-health-settings-excerpt.inp");
    expect(rc.healthEffects.healthInput?.records).toHaveLength(18);
    expect(rc.healthEffects.earlyHealthEffects).toHaveLength(3);
    expect(rc.healthEffects.latentHealthEffects).toHaveLength(8);
    expect(rc.economicFactors.siteEconomyInput).toMatchObject({ filename: "SecPop-Noah-published-site-excerpt.txt", economicMultiplier: 1.35, expectedRegions: 83 });
    expect(rc.economicFactors.siteEconomyInput?.regions).toHaveLength(2);
    expect(rc.economicFactors.siteEconomyInput?.crops).toHaveLength(7);
    expect(rc.economicFactors.costParameterEstimates).toEqual([]);
    expect(caseChecks(c).find(g => g.key === "site")!.items.join(" ")).toContain("receptor height");
    expect(rc.consequenceQuantification.eventSequenceConsequences).toEqual([]);
    expect(rc.releaseCategoryToConsequence.releaseCategoryAndSourceTermReviewed).toBe(false);
  });
  it("retains byte-exact government library files with independently recorded hashes", () => {
    const expected: Record<string, string> = { "NNDC-ENSDF-2023-04-03-mass-137.txt": "2e7c2a33de25ece5117a9ac6a1b620093096917e7ff89c95f94277181b39a671", "FGR13INH.HDB": "edd7d65edd36064137ca9cf2df9ce61c6de060a0eeb937d20df0deb5b9034b0d", "F12TIII1.EXT": "ba715095d9d05c79228f13ae26bd46412de2eae26d563bd3f9ef58139c0dac41", "F12TIII3.EXT": "0e5985f467b1d90ae08ab923ddc57d02fa2f59075754a216205cef067ea114f3" };
    for (const [name, sha] of Object.entries(expected)) expect(createHash("sha256").update(readRcPublishedFile(name)).digest("hex")).toBe(sha);
    expect(() => readRcPublishedFile("../../outside.txt")).toThrow("Unknown");
  });
  it("serves the source guide and health records as readable text", async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ExampleDocumentsController] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      for (const [id, filename] of [["rc-published-input-sources", "sources.txt"], ["rc-published-response-records", "MACCS-Noah-response-settings-excerpt.inp"], ["rc-published-health-records", "MACCS-Noah-health-settings-excerpt.inp"]]) {
        const response = await request(app.getHttpServer()).get(`/example-documents/rc/${id}`).expect(200);
        expect(response.headers["content-type"]).toBe("text/plain; charset=utf-8");
        expect(Buffer.from(response.text)).toEqual(readRcPublishedFile(filename));
      }
      const part = await request(app.getHttpServer()).get("/example-documents/rc/rc-published-input-sources").set("Range", "bytes=0-9").expect(206);
      expect(part.headers["accept-ranges"]).toBe("bytes");
      expect(Buffer.from(part.text)).toEqual(readRcPublishedFile("sources.txt").subarray(0, 10));
    } finally {
      await app.close();
    }
  });
  it("rejects health records altered without changing their original file", async () => {
    const loaded = (await load().expect(200)).body.mef;
    const altered = { ...loaded.healthEffects.healthInput.records[0], values: [999, 6.1, 2.3] };
    await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["healthEffects", "healthInput", "records", 0], value: altered }] }).expect(409);
  });
  it("rejects economic records altered without changing the original file", async () => {
    await load().expect(200);
    await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["economicFactors", "siteEconomyInput", "regions", 1, "farmlandValuePerHectare"], value: 999999 }] }).expect(409);
  });
  it("does not allow incomplete economic inputs to be confirmed", async () => {
    await load().expect(200);
    await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["economicFactors", "parameterConsistencyConfirmed"], value: true }] }).expect(403);
  });
  it("saves sourced cost values with their units and currency year", async () => {
    await load().expect(200);
    const row = { parameter: "Emergency evacuation", costCode: "EVACST", value: 20, currencyYear: 2020, dataBasis: "GENERIC_JUSTIFIED", source: "Analyst cost reference" };
    const saved = (await request(http()).patch(root).send({ operations: [
      { op: "add", path: ["economicFactors", "decontaminationLevels"], value: 1 },
      { op: "replace", path: ["economicFactors", "costParameterEstimates"], value: [row] },
    ] }).expect(200)).body.mef;
    expect(saved.economicFactors.costParameterEstimates).toEqual([row]);
    await request(http()).patch(root).send({ operations: [{ op: "replace", path: ["economicFactors", "costParameterEstimates", 0, "currencyYear"], value: null }] }).expect(403);
  });
  it("loads original files and an incomplete snapshot without changing another workbook", async () => {
    const before = await t.reset();
    await t.workbooks.create({ workbookId: "rc-other", projectId: "project", ownerUsername: "preparer", mef: before });
    const other = await t.workbooks.findOne({ workbookId: "rc-other" }).lean();
    const response = (await load().expect(200)).body, mef = response.mef;
    expect(t.app.get(ExampleWorkbooksService).getRcBundle).toHaveBeenCalledWith(RC_PUBLISHED_ID);
    expect(response.hasPreviousMef).toBe(true); expect(mef.workflowState).toBe("DRAFT");
    expect(await t.workbooks.findOne({ workbookId: "rc-other" }).lean()).toEqual(other);
    const data = currentRcCase(mef, RC_PUBLISHED_CATEGORY), files = caseFiles(data), saved = mef.consequenceQuantification.caseRecords;
    expect(data.schemaVersion).toBe(2);
    expect(caseTable(data, "health", 0).total).toBe(data.health!.healthInput!.records.length);
    expect(caseTable(data, "regions", 0).total).toBe(data.economy!.siteEconomyInput!.regions.length);
    expect(caseTable(data, "costs", 0).total).toBe(data.economy!.costParameterEstimates.length);
    expect(files).toHaveLength(12); expect(t.storage.size).toBe(13); expect(saved.snapshots).toHaveLength(1); expect(saved.results).toEqual([]);
    expect(saved.snapshots[0]).toMatchObject({ inventoryCount: 69, receptorCount: 0, trialCount: 24, integrationSeconds: 2592000 });
    expect(saved.snapshots[0].reviewItems).toBeGreaterThan(0);
    for (const entry of files) expect([...t.storage.values()].some(bytes => bytes.equals(readRcPublishedFile(entry.file.filename)))).toBe(true);
    const selection = { categoryId: RC_PUBLISHED_CATEGORY, versions: caseVersions(data), snapshotId: saved.snapshots[0].id };
    const review = (await request(http()).get(`${root}/case-records/review`).query(selection).expect(200)).body;
    expect(review.embedded.map((file: { filename: string }) => file.filename)).toEqual([data.health!.healthInput!.filename, data.economy!.siteEconomyInput!.filename]);
    expect((await request(http()).get(`${root}/case-records/table/health`).query(selection).expect(200)).body.total).toBe(data.health!.healthInput!.records.length);
    expect((await request(http()).get(`${root}/case-records/table/regions`).query(selection).expect(200)).body.total).toBe(data.economy!.siteEconomyInput!.regions.length);
    await request(http()).get(`${root}/case-records/text/health-original`).query(selection).expect(200);
    await request(http()).get(`${root}/case-records/text/economy-original`).query(selection).expect(200);
    for (const f of files) await request(http()).get(`${root}/case-records/text/${f.file.documentId}`).query(selection).expect(200);
    const doseFile = data.dose!.libraries.find(l => l.kind === "inhalation")!.file;
    const records = (await request(http()).get(`${root}/dose-inputs/records/${doseFile.documentId}`).query({ nuclide: "Cs-137" }).expect(200)).body;
    expect(records.some((r: any) => r.value === "4.673E-09")).toBe(true);
    await request(http()).post(`${root}/unload-example`).send({}).expect(200);
    expect((await request(http()).get(root)).body.mef).toEqual(before);
    expect(t.storage.size).toBe(13);
  });
  it("uses workbook-local original IDs and newer revisions on a second load", async () => {
    const first = (await load().expect(200)).body.mef, second = (await load().expect(200)).body.mef;
    const a = currentRcCase(first, RC_PUBLISHED_CATEGORY), b = currentRcCase(second, RC_PUBLISHED_CATEGORY);
    expect(b.source!.revision).toBeGreaterThan(a.source!.revision);
    expect(caseFiles(a).some(x => caseFiles(b).some(y => x.file.documentId === y.file.documentId))).toBe(false);
    const originalId = first.consequenceQuantification.caseRecords.snapshots[0].file.documentId;
    await request(http()).delete(`${root}/documents/${originalId}`).expect(403);
    await request(http()).post(`${root}/unload-example`).send({}).expect(200);
    expect((await request(http()).get(root)).body.mef.consequenceQuantification.caseRecords).toEqual(first.consequenceQuantification.caseRecords);
  });
  it("rejects viewers and review-locked loading without copying any files", async () => {
    for (const user of ["reviewer", "viewer", "outsider"]) await load(user).expect(403);
    expect(t.storage.size).toBe(0);
    await t.workbooks.updateOne({ workbookId: "rc-test" }, { $set: { "mef.workflowState": "IN_REVIEW" } });
    await load().expect(403); expect(t.storage.size).toBe(0);
  });
  it("rolls back files if copying or saving the example fails", async () => {
    const real = t.documents.upload.bind(t.documents), spy = jest.spyOn(t.documents, "upload").mockImplementation(async (...args) => {
      if (t.storage.size === 2) throw new Error("Test storage failure"); return real(...args);
    });
    await load().expect(500); expect(t.storage.size).toBe(0); expect(await t.files.countDocuments({})).toBe(0); spy.mockRestore();
    const conflict = jest.spyOn(t.documents, "upload").mockImplementation(async (...args) => {
      const entry = await real(...args); if (t.storage.size === RC_PUBLISHED_FILES.filter(file => file.kind !== "reference").length + 1) await t.workbooks.updateOne({ workbookId: "rc-test" }, { $inc: { __v: 1 } }); return entry;
    });
    await load().expect(409); expect(t.storage.size).toBe(0); conflict.mockRestore();
  });
});
