import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import request from "supertest";
import { getModelToken } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { RcCaseRecords } from "interfaces-mef-types/rc/case-records";
import type {
  RcConsequenceRun,
  RcConsequenceRunDetails,
  RcConsequenceRunSetup,
  RcConsequenceRunTextPage,
  RcConsequenceRunTrialPage,
} from "interfaces-mef-types/rc/consequence-runs";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { caseVersions, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { createPublishedRcSeed, RC_PUBLISHED_CATEGORY } from "../../example-workbooks/seeds/rc-published-inputs-seed";
import type { OpenRcRequestEnvelope } from "../openrc-case-adapters";
import { PraetorConsequenceClient } from "../praetor-consequence.client";
import { RcConsequenceRunRecord, RcConsequenceRunSchema, type RcConsequenceRunDocument } from "../rc-consequence-run.schema";
import { RcConsequenceRunsController } from "../rc-consequence-runs.controller";
import { RcConsequenceRunsService } from "../rc-consequence-runs.service";
import { RcPublishedExampleService } from "../rc-published-example.service";
import { seedRcCase } from "./case-records-test-fixture";
import { STAND_IN_ENGINE, StandInPraetor } from "./openrc-run-stand-in";
import { openRcReferenceCases, publishedCase } from "./openrc-test-cases";
import { createSourceTermTestApp } from "./source-term-test-app";

interface ReferenceDoses {
  tede_sv?: number;
  missing_dcfs?: string[];
  tede_msv?: number[];
}

interface ReferenceCase {
  name: string;
  requests: OpenRcRequestEnvelope["request"][];
  doses: ReferenceDoses[];
}

interface ReferenceFile {
  cases: ReferenceCase[];
}

const EXACT = process.env["OPENRC_EXACT"] === "1";
const TOLERANCE = 1e-10;
const WORKBOOK = "rc-test";
const ROOT = `/rc-workbooks/${WORKBOOK}`;
const RUNS = `${ROOT}/consequence-runs`;
const CASES = `${ROOT}/case-records`;
const PREPARER = { username: "preparer" };

const closeTo = (actual: number, expected: number): boolean =>
  EXACT ? actual === expected : Math.abs(actual - expected) <= TOLERANCE * Math.max(Math.abs(expected), Number.MIN_VALUE);

const pythonPercentile = (doses: readonly number[], percentile: number): number => {
  const sorted = [...doses].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];
  const position = (percentile / 100) * (sorted.length - 1);
  const low = Math.trunc(position);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
};

const pythonDoses = (entry: ReferenceCase, trialCount: number): number[] =>
  Array.from({ length: trialCount }, (_trial, index) =>
    entry.doses.reduce((sum, doses) => sum + (doses.tede_msv === undefined ? (doses.tede_sv ?? Number.NaN) : doses.tede_msv[index] / 1000), 0),
  );

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("OpenRC runs of an RC case", () => {
  const reference: ReferenceFile = JSON.parse(readFileSync(join(__dirname, "openrc-python-reference.json"), "utf8"));
  const praetor = new StandInPraetor();
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  let runs: Model<RcConsequenceRunDocument>;
  let service: RcConsequenceRunsService;
  const http = () => t.app.getHttpServer();

  beforeAll(async () => {
    t = await createSourceTermTestApp({
      features: [{ name: RcConsequenceRunRecord.name, schema: RcConsequenceRunSchema }],
      controllers: [RcConsequenceRunsController],
      providers: [RcConsequenceRunsService, { provide: PraetorConsequenceClient, useValue: praetor }],
    });
    runs = t.app.get<Model<RcConsequenceRunDocument>>(getModelToken(RcConsequenceRunRecord.name));
    service = t.app.get(RcConsequenceRunsService);
  }, 120000);

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    praetor.reset();
    await runs.deleteMany({}).exec();
    await t.reset();
  });

  afterEach(async () => {
    praetor.held = false;
    for (let waited = 0; service["following"].size > 0 && waited < 200; waited += 1) await pause(25);
    expect(service["following"].size).toBe(0);
  });

  const mefNow = async (): Promise<RadiologicalConsequenceAnalysis> => (await request(http()).get(ROOT).expect(200)).body.mef;

  const recordsNow = async (): Promise<RcCaseRecords> => {
    const records = (await mefNow()).consequenceQuantification.caseRecords;
    if (records === undefined) throw new Error("The workbook has no case records");
    return records;
  };

  async function loadPublished(): Promise<string> {
    const prepared = await t.app.get(RcPublishedExampleService).prepare(WORKBOOK, createPublishedRcSeed(), 1, PREPARER);
    await t.workbooks.updateOne({ workbookId: WORKBOOK }, { $set: { mef: JSON.parse(JSON.stringify(prepared.mef)), __v: 1 } }).exec();
    return (await recordsNow()).snapshots[0].id;
  }

  async function hourlySnapshot(): Promise<string> {
    await loadPublished();
    const weather = (await mefNow()).meteorologicalData.weatherInputs;
    if (weather?.model === undefined) throw new Error("The published example has no weather model");
    await t.workbooks
      .updateOne(
        { workbookId: WORKBOOK },
        {
          $set: {
            "mef.meteorologicalData.weatherInputs.model": { ...weather.model, mode: "stratified", sampling: { randomSeed: 1, samplesPerDay: 24 } },
            "mef.meteorologicalData.weatherInputs.revision": weather.revision + 1,
          },
        },
      )
      .exec();
    const versions = caseVersions(currentRcCase(await mefNow(), RC_PUBLISHED_CATEGORY));
    const saved = await request(http())
      .post(`${CASES}/snapshots`)
      .send({ baseRevision: (await recordsNow()).revision, categoryId: RC_PUBLISHED_CATEGORY, versions })
      .expect(200);
    return saved.body.snapshotId;
  }

  const start = (body: object, user = "preparer") => request(http()).post(RUNS).set("x-test-user", user).send(body);

  const listed = async (): Promise<RcConsequenceRun[]> => (await request(http()).get(RUNS).expect(200)).body.runs;

  const detailed = async (runId: string): Promise<RcConsequenceRunDetails> => (await request(http()).get(`${RUNS}/${runId}`).expect(200)).body;

  async function settled(runId: string): Promise<RcConsequenceRunDetails> {
    for (let waited = 0; waited < 1200; waited += 1) {
      const details = await detailed(runId);
      if (details.run.status !== "QUEUED" && details.run.status !== "RUNNING") return details;
      await pause(25);
    }
    throw new Error(`OpenRC run ${runId} did not finish`);
  }

  async function finished(body: object): Promise<RcConsequenceRunDetails> {
    const started: RcConsequenceRun = (await start(body).expect(200)).body;
    return settled(started.id);
  }

  const trialPage = async (runId: string, query: object): Promise<RcConsequenceRunTrialPage> =>
    (await request(http()).get(`${RUNS}/${runId}/trials`).query(query).expect(200)).body;

  const filePage = async (runId: string, kind: string, offset = 0): Promise<RcConsequenceRunTextPage> =>
    (await request(http()).get(`${RUNS}/${runId}/files/${kind}`).query({ offset }).expect(200)).body;

  const ghostRun = (sequence: number, status: RcConsequenceRun["status"], trackedAt: Date) => ({
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    workbookId: WORKBOOK,
    sequence,
    categoryId: RC_PUBLISHED_CATEGORY,
    snapshotId: "00000000-0000-4000-9000-000000000001",
    snapshotLabel: "Case 01",
    metricId: "RCM-01",
    metricName: "30-day dose at the EAB",
    unit: "Sv",
    receptorKind: "EAB_MAXIMUM" as const,
    windowSeconds: 2592000,
    statistics: { mean: true, percentiles: [], exceedanceThresholds: [] },
    distancesMetres: [746],
    heightMetres: 0,
    trialCount: 1,
    jobs: [{ jobId: `ghost-${sequence}`, distanceIndex: 0, part: 0 }],
    notes: [],
    status,
    requestedBy: "preparer",
    requestedAt: trackedAt,
    startedAt: null,
    completedAt: null,
    trackedAt,
    engineVersion: null,
    failure: null,
    progress: null,
    result: null,
    trials: [],
    input: { metFileText: "", configTexts: [""] },
    output: [],
    doses: [],
  });

  it("tells what a snapshot can run and offers the receptor distances and height of its site", async () => {
    const mef = await seedRcCase(t);
    const versions = caseVersions(currentRcCase(mef, "RC-1"));
    const saved = (await request(http()).post(`${CASES}/snapshots`).send({ baseRevision: 0, categoryId: "RC-1", versions }).expect(200)).body;
    const setup: RcConsequenceRunSetup = (await request(http()).get(`${RUNS}/setup`).query({ snapshotId: saved.snapshotId }).expect(200)).body;
    const geometry = mef.protectiveActionParameters.siteAndReceptors?.geometry;
    if (geometry?.kind !== "cells") throw new Error("The fixture site is not a grid of cells");
    expect(setup.snapshotId).toBe(saved.snapshotId);
    expect(setup.trialCount).toBe(1);
    expect(setup.heightMetres).toBe(1.5);
    expect(setup.distancesMetres).toHaveLength(geometry.radiiKm.length);
    expect(setup.distancesMetres).toEqual(
      geometry.radiiKm.map((outer, band) => Number(((((band === 0 ? 0 : geometry.radiiKm[band - 1]) + outer) / 2) * 1000).toPrecision(12))),
    );
    expect(setup.distancesMetres.every((distance, index) => index === 0 || distance > setup.distancesMetres[index - 1])).toBe(true);
    expect(setup.metrics).toEqual([
      { id: "RCM-01", name: "Individual dose at boundary", receptorKind: "EAB_MAXIMUM", runnable: true, reason: "" },
      { id: "RCM-02", name: "Population dose to 80 km", receptorKind: null, runnable: false, reason: "OpenRC reports dose at receptors, not population dose." },
    ]);
    await request(http()).get(`${RUNS}/setup`).query({ snapshotId: "00000000-0000-4000-8000-000000000000" }).expect(404);
    await request(http()).get(`${RUNS}/setup`).query({ snapshotId: saved.snapshotId }).set("x-test-user", "outsider").expect(403);
    expect((await request(http()).get(`${RUNS}/setup`).query({ snapshotId: saved.snapshotId }).set("x-test-user", "reviewer").expect(200)).body).toEqual(setup);
  });

  it("offers no site distances or height when the snapshot has an incomplete site, and marks the published risk metrics", async () => {
    const snapshotId = await loadPublished();
    const setup: RcConsequenceRunSetup = (await request(http()).get(`${RUNS}/setup`).query({ snapshotId }).expect(200)).body;
    expect(setup.distancesMetres).toEqual([]);
    expect(setup.heightMetres).toBeNull();
    expect(setup.trialCount).toBe(1);
    expect(setup.metrics.map((metric) => [metric.id, metric.receptorKind, metric.runnable])).toEqual([
      ["RCM-01", "EAB_MAXIMUM", true],
      ["RCM-02", "DISTANCE_PROFILE", true],
      ["RCM-03", null, false],
      ["RCM-04", null, false],
    ]);
    expect(setup.metrics[2].reason).toBe("OpenRC has no health-effect model yet.");
  });

  it("refuses a run that cannot be written and says why", async () => {
    const mef = await seedRcCase(t);
    const versions = caseVersions(currentRcCase(mef, "RC-1"));
    const snapshotId: string = (await request(http()).post(`${CASES}/snapshots`).send({ baseRevision: 0, categoryId: "RC-1", versions }).expect(200)).body.snapshotId;
    const good = { snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 };
    const refused = async (body: object, status: number): Promise<string> => (await start(body).expect(status)).body.message;
    expect(await refused(good, 400)).toBe("Release category 'RC-1' has no saved deposition velocities and decay mode");
    expect(await refused({ ...good, metricId: "RCM-02" }, 400)).toBe(
      "OpenRC cannot quantify the metric 'Population dose to 80 km': OpenRC reports dose at receptors, not population dose.",
    );
    expect(await refused({ ...good, metricId: "RCM-09" }, 400)).toBe("Choose a consequence metric from the selected input snapshot");
    expect(await refused({ ...good, distancesMetres: [] }, 400)).toBe("Give at least one receptor distance");
    expect(await refused({ ...good, distancesMetres: [746, -1] }, 400)).toBe("Receptor distances must be greater than 0 m");
    expect(await refused({ ...good, distancesMetres: [746, 746] }, 400)).toBe("Give each receptor distance once");
    expect(await refused({ ...good, distancesMetres: [746, 1000] }, 400)).toBe("A dose at the EAB takes one receptor distance");
    expect(await refused({ ...good, distancesMetres: ["746"] }, 400)).toBe("Receptor distances must be numbers in metres");
    expect(await refused({ ...good, distancesMetres: Array.from({ length: 101 }, (_distance, index) => index + 1) }, 400)).toBe(
      "A run takes at most 100 receptor distances",
    );
    expect(await refused({ ...good, heightMetres: -1 }, 400)).toBe("The receptor height cannot be negative");
    expect(await refused({ snapshotId, metricId: "RCM-01", distancesMetres: [746] }, 400)).toBe("Give the receptor height in metres");
    expect(await refused({ ...good, snapshotId: "not-a-snapshot" }, 400)).toBe("Choose an input snapshot");
    expect(await refused({ ...good, snapshotId: "00000000-0000-4000-8000-000000000000" }, 404)).toBe("Input snapshot not found");
    await start({ ...good, extra: true }).expect(400);
    await start({}).expect(400);
    expect(await listed()).toEqual([]);
    expect(praetor.submitted).toEqual([]);
  });

  it("runs the published distance metric as three jobs and gives the dose of the Python reference engine", async () => {
    const snapshotId = await loadPublished();
    const hour = reference.cases[5];
    expect(hour.name).toBe("published source term, first published weather hour, 8046.7 m");
    const started: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 }).expect(200)).body;
    expect(started).toMatchObject({
      label: "Run 01",
      categoryId: RC_PUBLISHED_CATEGORY,
      snapshotId,
      snapshotLabel: "Published inputs",
      metricId: "RCM-02",
      metricName: "96-hour dose by distance",
      unit: "Sv",
      receptorKind: "DISTANCE_PROFILE",
      windowSeconds: 345600,
      statistics: { mean: true, percentiles: [50, 95], exceedanceThresholds: [0.01] },
      distancesMetres: [8046.7],
      heightMetres: 0,
      trialCount: 1,
      jobCount: 3,
      status: "QUEUED",
      requestedBy: "preparer",
      startedAt: null,
      completedAt: null,
      engineVersion: null,
      failure: null,
      progress: { completed: 0, total: 3, queuedJobs: null, workers: null },
    });
    expect(started.notes).toEqual(openRcReferenceCases(publishedCase())[5].adapted.notes.map((note) => ({ code: note.code, message: note.message })));
    expect(started.notes.map((note) => note.code)).toEqual(["NUCLIDES_WITHOUT_CHEMICAL_GROUP", "WINDOW_COUNTED_FROM_RELEASE_ONSET"]);
    expect(praetor.submitted.map((entry) => entry.jobId)).toEqual([`${started.id}-1`, `${started.id}-2`, `${started.id}-3`]);
    expect(praetor.submitted.map((entry) => entry.request)).toEqual(hour.requests.map((entry) => ({ schemaVersion: "1.0.0", request: entry })));

    const { run, result } = await settled(started.id);
    const dose = pythonDoses(hour, 1)[0];
    expect(run).toMatchObject({ status: "SUCCEEDED", engineVersion: STAND_IN_ENGINE, failure: null, progress: null, jobCount: 3 });
    expect(run.startedAt).not.toBeNull();
    expect(run.completedAt).not.toBeNull();
    if (result === null) throw new Error("The run has no result");
    expect(result.missingDoseCoefficients).toEqual(["Nb-97m"]);
    expect(result.distances).toHaveLength(1);
    const [row] = result.distances;
    expect(row.distanceMetres).toBe(8046.7);
    expect(closeTo(row.statistics.mean ?? Number.NaN, dose)).toBe(true);
    expect(row.statistics.percentiles.map((entry) => entry.percentile)).toEqual([50, 95]);
    expect(row.statistics.percentiles.every((entry) => entry.value === row.statistics.mean)).toBe(true);
    expect(row.statistics.exceedances).toEqual([{ threshold: 0.01, probability: 1 }]);
    expect(row.minimumSv).toBe(row.statistics.mean);
    expect(row.maximumSv).toBe(row.statistics.mean);
    expect(row.groundDepositionBqPerSquareMetre).toBeGreaterThan(0);
    const nuclides = row.nuclideDoses ?? [];
    expect(nuclides.length).toBeGreaterThan(40);
    expect(nuclides.every((entry, index) => index === 0 || entry.doseSv <= nuclides[index - 1].doseSv)).toBe(true);
    expect(Math.abs(nuclides.reduce((sum, entry) => sum + entry.doseSv, 0) - dose)).toBeLessThan(1e-9 * dose);
    expect(nuclides.some((entry) => entry.nuclide === "Co-60")).toBe(false);

    const page = await trialPage(run.id, { distance: 0 });
    expect(page).toMatchObject({ distanceMetres: 8046.7, total: 1, offset: 0, size: 10 });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ trialId: "D001P01", start: "Day 1, period 1", selectionGroup: "Fixed start", doseSv: row.statistics.mean });
    expect(page.rows[0].dispersionSecondsPerCubicMetre).toBeGreaterThan(0);
    expect(hour.requests[0].metFileText.split("\n")[1].split(",")[0]).toBe(page.rows[0].stabilityClass);

    const head = await filePage(run.id, "output");
    const output: string[] = [];
    for (let offset = 0; offset < head.total; offset += head.size) output.push(...(await filePage(run.id, "output", offset)).text.split("\n"));
    const returned = (key: string): number[] => {
      const prefix = `  "${key}": `;
      return output.filter((line) => line.startsWith(prefix)).map((line) => Number(line.slice(prefix.length).split(",")[0]));
    };
    expect(returned("tede_sv")).toEqual(hour.doses.map((doses) => doses.tede_sv));
    expect(returned("ground_deposition_bq_m2")).toHaveLength(3);
    expect(closeTo(row.groundDepositionBqPerSquareMetre ?? Number.NaN, returned("ground_deposition_bq_m2").reduce((sum, value) => sum + value, 0))).toBe(true);
    expect(returned("ground_deposition_bq_m2").every((value) => value > 0 && value < (row.groundDepositionBqPerSquareMetre ?? 0))).toBe(true);
    expect(new Set(returned("chi_over_q_s_m3")).size).toBe(1);
    expect(page.rows[0].dispersionSecondsPerCubicMetre).toBe(returned("chi_over_q_s_m3")[0]);
  });

  it("runs 24 weather hours at the boundary and matches the Python reference engine trial by trial", async () => {
    const snapshotId = await hourlySnapshot();
    const day = reference.cases[4];
    expect(day.name).toBe("published source term, 24 published weather hours, 746 m");
    const { run, result } = await finished({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 });
    expect(praetor.submitted.map((entry) => entry.request)).toEqual(day.requests.map((entry) => ({ schemaVersion: "1.0.0", request: entry })));
    expect(run).toMatchObject({ status: "SUCCEEDED", snapshotLabel: "Case 02", receptorKind: "EAB_MAXIMUM", trialCount: 24, jobCount: 3, windowSeconds: 2592000 });
    if (result === null) throw new Error("The run has no result");
    const python = pythonDoses(day, 24);
    const [row] = result.distances;
    expect(result.missingDoseCoefficients).toBeUndefined();
    expect(row.nuclideDoses).toBeUndefined();
    expect(row.groundDepositionBqPerSquareMetre).toBeUndefined();
    expect(closeTo(row.statistics.mean ?? Number.NaN, python.reduce((sum, dose) => sum + dose, 0) / 24)).toBe(true);
    expect(row.statistics.percentiles.map((entry) => entry.percentile)).toEqual([5, 50, 95]);
    expect(row.statistics.percentiles.every((entry) => closeTo(entry.value, pythonPercentile(python, entry.percentile)))).toBe(true);
    expect(row.statistics.exceedances).toEqual([{ threshold: 0.001, probability: 1 }]);
    expect(closeTo(row.minimumSv, Math.min(...python))).toBe(true);
    expect(closeTo(row.maximumSv, Math.max(...python))).toBe(true);

    const pages = [await trialPage(run.id, { distance: 0 }), await trialPage(run.id, { distance: 0, offset: 10 }), await trialPage(run.id, { distance: 0, offset: 20 })];
    expect(pages.map((page) => [page.total, page.offset, page.size, page.rows.length])).toEqual([
      [24, 0, 10, 10],
      [24, 10, 10, 10],
      [24, 20, 10, 4],
    ]);
    const rows = pages.flatMap((page) => page.rows);
    expect(rows.every((entry, index) => closeTo(entry.doseSv, python[index]))).toBe(true);
    expect(rows.map((entry) => entry.trialId)).toEqual(publishedCase().hourly.map((trial) => trial.id));
    expect(rows.every((entry) => entry.dispersionSecondsPerCubicMetre !== null && entry.dispersionSecondsPerCubicMetre > 0)).toBe(true);
    const head = await filePage(run.id, "output");
    const output: string[] = [];
    for (let offset = 0; offset < head.total; offset += head.size) output.push(...(await filePage(run.id, "output", offset)).text.split("\n"));
    const returned: { chi_over_q_s_m3: number; stability_class: string }[] = output
      .filter((line) => line.startsWith('    {"index":'))
      .slice(0, 24)
      .map((line) => JSON.parse(line.endsWith(",") ? line.slice(0, -1) : line));
    expect(rows.map((entry) => entry.dispersionSecondsPerCubicMetre)).toEqual(returned.map((entry) => entry.chi_over_q_s_m3));
    expect(rows.map((entry) => entry.stabilityClass)).toEqual(returned.map((entry) => entry.stability_class));
    expect(new Set(rows.map((entry) => entry.dispersionSecondsPerCubicMetre)).size).toBeGreaterThan(1);
    expect(rows.every((entry) => entry.selectionGroup === "Day 1" && entry.start.startsWith("Day 1, period "))).toBe(true);

    const highest = await trialPage(run.id, { distance: 0, order: "dose" });
    expect(highest.rows).toHaveLength(10);
    expect(highest.rows[0].doseSv).toBe(row.maximumSv);
    expect(highest.rows.every((entry, index) => index === 0 || entry.doseSv <= highest.rows[index - 1].doseSv)).toBe(true);
    await request(http()).get(`${RUNS}/${run.id}/trials`).query({ distance: 1 }).expect(400);
    await request(http()).get(`${RUNS}/${run.id}/trials`).query({ distance: 0, offset: -1 }).expect(400);
    await request(http()).get(`${RUNS}/${run.id}/trials`).query({ distance: 0, order: "name" }).expect(400);
    await request(http()).get(`${RUNS}/${run.id}/trials`).query({ distance: 0 }).set("x-test-user", "outsider").expect(403);
  });

  it("runs a dose by distance, records it as the category result and keeps the whole profile", async () => {
    const snapshotId = await loadPublished();
    const { run, result } = await finished({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7, 2000, 16093.4], heightMetres: 0 });
    if (result === null) throw new Error("The run has no result");
    expect(run.distancesMetres).toEqual([2000, 8046.7, 16093.4]);
    expect(run.jobCount).toBe(9);
    expect(praetor.submitted).toHaveLength(9);
    expect(result.distances.map((row) => row.distanceMetres)).toEqual([2000, 8046.7, 16093.4]);
    const means = result.distances.map((row) => row.statistics.mean ?? Number.NaN);
    expect(means[0]).toBeGreaterThan(means[1]);
    expect(means[1]).toBeGreaterThan(means[2]);
    expect(closeTo(means[1], pythonDoses(reference.cases[5], 1)[0])).toBe(true);
    expect((await trialPage(run.id, { distance: 2 })).rows[0].doseSv).toBe(means[2]);

    const before = await recordsNow();
    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: before.revision + 1, distanceIndex: 1 }).expect(409);
    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: before.revision, distanceIndex: 3 }).expect(400);
    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: before.revision }).expect(400);
    for (const user of ["reviewer", "viewer", "outsider"]) {
      await request(http()).post(`${RUNS}/${run.id}/record`).set("x-test-user", user).send({ baseRevision: before.revision, distanceIndex: 1 }).expect(403);
    }
    const stored = t.storage.size;
    const records: RcCaseRecords = (await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: before.revision, distanceIndex: 1 }).expect(200)).body;
    expect(records.results).toHaveLength(before.results.length + 1);
    const recorded = records.results[records.results.length - 1];
    expect(recorded).toMatchObject({
      snapshotId,
      categoryId: RC_PUBLISHED_CATEGORY,
      metricId: "RCM-02",
      unit: "Sv",
      statistics: result.distances[1].statistics,
      version: "OpenRC 0123456789ab",
      reference: "Run 01",
      confirmed: true,
      recordedBy: "preparer",
      valueSource: "calculated",
      calculation: { engine: "OPENRC", engineVersion: STAND_IN_ENGINE, runId: run.id, runLabel: "Run 01", distanceMetres: 8046.7, heightMetres: 0, trialCount: 1 },
      profile: result.distances.map((row) => ({ distanceMetres: row.distanceMetres, statistics: row.statistics })),
    });
    expect(recorded.file.filename).toBe("OpenRC-Run-01-output.txt");
    expect(t.storage.size).toBe(stored + 1);
    expect(await recordsNow()).toEqual(records);

    const output = (await request(http()).get(`${CASES}/results/${recorded.id}/output`).expect(200)).body;
    expect(output.text.split("\n").slice(0, 3)).toEqual(["OpenRC input for Run 01", `Release category: ${RC_PUBLISHED_CATEGORY}`, "Consequence metric: 96-hour dose by distance"]);
    const artifact = [...t.storage.values()].map((bytes) => bytes.toString("utf8")).find((text) => text.startsWith("OpenRC input for Run 01"));
    if (artifact === undefined) throw new Error("The recorded output was not stored");
    expect(artifact.split("\n").filter((line) => line.startsWith("===== Request ")).map((line) => line.split(":")[0])).toEqual(
      Array.from({ length: 18 }, (_request, index) => `===== Request ${(index % 9) + 1} of 9`),
    );
    expect(artifact).toContain("===== Request 4 of 9: receptor at 8046.7 m, part 1 of 3 =====");
    expect(artifact).toContain(`Engine: ${STAND_IN_ENGINE}`);
    expect(artifact).toContain("===== Weather file of every request =====");
    expect(artifact).toContain(reference.cases[5].requests[0].configText.split("\n").slice(0, 5).join("\n"));
    expect(artifact).toContain('  "missing_dcfs": ["Nb-97m"],');
    expect(artifact.endsWith("}\n")).toBe(true);

    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: records.revision, distanceIndex: 0 }).expect(409);
    const renamed: RadiologicalConsequenceAnalysis = (
      await request(http())
        .patch(ROOT)
        .send({ operations: [{ op: "replace", path: ["scope", "metrics", 1, "name"], value: "96-hour dose by distance, renamed" }] })
        .expect(200)
    ).body.mef;
    const kept = renamed.consequenceQuantification.caseRecords?.results ?? [];
    expect(kept[kept.length - 1]).toEqual(recorded);
    await request(http())
      .patch(ROOT)
      .send({ operations: [{ op: "replace", path: ["consequenceQuantification", "caseRecords", "results", kept.length - 1, "reference"], value: "Run 99" }] })
      .expect(409);
    await request(http())
      .patch(ROOT)
      .send({ operations: [{ op: "replace", path: ["consequenceQuantification", "caseRecords", "results", kept.length - 1, "valueSource"], value: "transcribed" }] })
      .expect(403);

    const removed: RcCaseRecords = (
      await request(http()).post(`${CASES}/results/${recorded.id}/remove`).send({ baseRevision: (await recordsNow()).revision }).expect(200)
    ).body;
    expect(removed.results).toHaveLength(before.results.length);
    expect(t.storage.size).toBe(stored);
    const again: RcCaseRecords = (await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: removed.revision, distanceIndex: 0 }).expect(200)).body;
    expect(again.results[again.results.length - 1].calculation?.distanceMetres).toBe(2000);
    expect(again.results[again.results.length - 1].statistics).toEqual(result.distances[0].statistics);
  });

  it("records a dose at the EAB without a profile and copies its mean to every mapped family", async () => {
    const snapshotId = await loadPublished();
    const families = [{ referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-test", entityId: "ESF-EARLY" }];
    await t.workbooks.updateOne({ workbookId: WORKBOOK }, { $set: { "mef.releaseCategoryToConsequence.releaseCategoryInputs.0.eventSequenceFamilyReferences": families } }).exec();
    const { run, result } = await finished({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 1.5 });
    if (result === null) throw new Error("The run has no result");
    const records: RcCaseRecords = (await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: (await recordsNow()).revision, distanceIndex: 0 }).expect(200)).body;
    const recorded = records.results[records.results.length - 1];
    expect(recorded.profile).toBeUndefined();
    expect(recorded.calculation).toMatchObject({ distanceMetres: 746, heightMetres: 1.5, trialCount: 1 });
    expect(recorded.statistics).toEqual(result.distances[0].statistics);
    const consequences = (await mefNow()).consequenceQuantification.eventSequenceConsequences;
    expect(consequences.map((entry) => [entry.uuid, entry.origin, entry.releaseCategoryReference])).toEqual([["RCQ-ESF-EARLY", "CATEGORY_RESULT", RC_PUBLISHED_CATEGORY]]);
    expect(consequences[0].consequenceResults).toHaveLength(1);
    expect(consequences[0].consequenceResults[0]).toMatchObject({ metric: "30-day dose at the EAB", meanValue: result.distances[0].statistics.mean, unit: "Sv" });
    const description = consequences[0].consequenceResults[0].uncertaintyDescription ?? "";
    expect(description.split(" · ").filter((part) => part.includes("percentile")).map((part) => part.endsWith("—"))).toEqual([true, false, true]);
  });

  it("reports waiting jobs and workers, and cancels a run in PRAETOR", async () => {
    const snapshotId = await loadPublished();
    praetor.held = true;
    praetor.workers = 0;
    const started: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 }).expect(200)).body;
    let waiting = (await listed())[0];
    for (let waited = 0; waiting.progress?.workers !== 0 && waited < 400; waited += 1) {
      await pause(25);
      waiting = (await listed())[0];
    }
    expect(waiting).toMatchObject({ id: started.id, status: "QUEUED", startedAt: null, progress: { completed: 0, total: 3, queuedJobs: 3, workers: 0 } });
    const followed = await runs.findOne({ id: started.id }).select({ _id: 0, requestedAt: 1, trackedAt: 1 }).lean().exec();
    expect(followed?.trackedAt?.getTime() ?? 0).toBeGreaterThan(followed?.requestedAt.getTime() ?? Number.POSITIVE_INFINITY);
    await runs.updateOne({ id: started.id }, { $set: { trackedAt: new Date(Date.now() - 600000) } }).exec();
    await service["sweepOrphans"]();
    expect((await detailed(started.id)).run.status).toBe("QUEUED");
    expect(praetor.cancelled).toEqual([]);
    expect((await detailed(started.id)).result).toBeNull();
    await request(http()).get(`${RUNS}/${started.id}/trials`).query({ distance: 0 }).expect(409);
    await request(http()).get(`${RUNS}/${started.id}/files/output`).expect(409);
    await request(http()).post(`${RUNS}/${started.id}/record`).send({ baseRevision: (await recordsNow()).revision, distanceIndex: 0 }).expect(409);
    await request(http()).post(`${RUNS}/${started.id}/remove`).send({}).expect(409);
    for (const user of ["reviewer", "viewer", "outsider"]) await request(http()).post(`${RUNS}/${started.id}/cancel`).set("x-test-user", user).send({}).expect(403);

    const cancelled: RcConsequenceRun = (await request(http()).post(`${RUNS}/${started.id}/cancel`).send({}).expect(200)).body;
    expect(cancelled).toMatchObject({ status: "CANCELLED", failure: null, progress: null, startedAt: null });
    expect(cancelled.completedAt).not.toBeNull();
    expect([...new Set(praetor.cancelled)].sort()).toEqual([`${started.id}-1`, `${started.id}-2`, `${started.id}-3`]);
    praetor.held = false;
    for (let waited = 0; service["following"].size > 0 && waited < 400; waited += 1) await pause(25);
    expect((await detailed(started.id)).run.status).toBe("CANCELLED");
    expect((await request(http()).post(`${RUNS}/${started.id}/cancel`).send({}).expect(200)).body.status).toBe("CANCELLED");

    for (const user of ["reviewer", "viewer", "outsider"]) await request(http()).post(`${RUNS}/${started.id}/remove`).set("x-test-user", user).send({}).expect(403);
    expect((await request(http()).post(`${RUNS}/${started.id}/remove`).send({}).expect(200)).body).toEqual({ removed: started.id });
    await request(http()).get(`${RUNS}/${started.id}`).expect(404);
    await request(http()).post(`${RUNS}/${started.id}/remove`).send({}).expect(404);
    expect(await listed()).toEqual([]);
  });

  it("moves from queued to running to finished while its jobs are followed", async () => {
    const snapshotId = await loadPublished();
    praetor.held = true;
    const started: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 }).expect(200)).body;
    expect(started.status).toBe("QUEUED");
    praetor.held = false;
    const seen = new Set<string>();
    for (let waited = 0; waited < 1200; waited += 1) {
      const status = (await detailed(started.id)).run.status;
      seen.add(status);
      if (status === "SUCCEEDED") break;
      await pause(5);
    }
    expect(seen.has("SUCCEEDED")).toBe(true);
    expect(seen.has("RUNNING")).toBe(true);
    expect([...seen].every((status) => ["QUEUED", "RUNNING", "SUCCEEDED"].includes(status))).toBe(true);
    const done = (await detailed(started.id)).run;
    expect(Date.parse(done.startedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(done.requestedAt));
    expect(Date.parse(done.completedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(done.startedAt ?? ""));
  });

  it("names every engine build that served its jobs", async () => {
    const snapshotId = await loadPublished();
    const linux = `sha256:${"ab".repeat(32)}`;
    praetor.engineVersions = [linux, STAND_IN_ENGINE, linux];
    const { run } = await finished({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 });
    expect(run.status).toBe("SUCCEEDED");
    expect(run.engineVersion).toBe(`${STAND_IN_ENGINE}, ${linux}`);
    const head = await filePage(run.id, "output");
    const output: string[] = [];
    for (let offset = 0; offset < head.total; offset += head.size) output.push(...(await filePage(run.id, "output", offset)).text.split("\n"));
    expect(output.filter((line) => line.startsWith("Engine: "))).toEqual([
      `Engine: ${STAND_IN_ENGINE}, ${linux}`,
      `Engine: ${linux}`,
      `Engine: ${STAND_IN_ENGINE}`,
      `Engine: ${linux}`,
    ]);
    const titles = output.flatMap((line, index) => (line.startsWith("===== Request ") ? [index] : []));
    expect(titles.map((index) => output[index + 1].startsWith("Engine: "))).toEqual([true, true, true]);
    const records: RcCaseRecords = (await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: (await recordsNow()).revision, distanceIndex: 0 }).expect(200)).body;
    const recorded = records.results[records.results.length - 1];
    expect(recorded.version).toBe("OpenRC 0123456789ab, abababababab");
    expect(recorded.calculation?.engineVersion).toBe(`${STAND_IN_ENGINE}, ${linux}`);
  });

  it("ends as cancelled when PRAETOR cancels one of its jobs, and stops the others", async () => {
    const snapshotId = await loadPublished();
    praetor.held = true;
    const started: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 }).expect(200)).body;
    await praetor.cancel(`${started.id}-2`);
    praetor.cancelled.length = 0;
    praetor.held = false;
    const { run, result } = await settled(started.id);
    expect(run).toMatchObject({ status: "CANCELLED", failure: null, progress: null });
    expect(result).toBeNull();
    expect([...praetor.cancelled].sort()).toEqual([`${started.id}-1`, `${started.id}-3`]);
  });

  it("stops the jobs of a run that is gone", async () => {
    const snapshotId = await loadPublished();
    praetor.held = true;
    const started: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 }).expect(200)).body;
    await runs.deleteOne({ id: started.id }).exec();
    praetor.held = false;
    for (let waited = 0; service["following"].size > 0 && waited < 400; waited += 1) await pause(25);
    expect([...praetor.cancelled].sort()).toEqual([`${started.id}-1`, `${started.id}-2`, `${started.id}-3`]);
    expect(await listed()).toEqual([]);
  });

  it("says why when the weather trials of a snapshot cannot be generated", async () => {
    await loadPublished();
    const records = await recordsNow();
    const kept = [...t.storage.entries()].find(([key]) => key.includes(records.snapshots[0].file.documentId));
    if (kept === undefined) throw new Error("The published snapshot is not stored");
    const saved = JSON.parse(kept[1].toString("utf8"));
    saved.inputs.weather.model = { mode: "constant", constant: { windSpeedMetresPerSecond: 2, windDirection: "uniform", stabilityClass: "D", rainMillimetresPerHour: 0, mixingHeightMetres: 800 } };
    saved.inputs.weather.settings = {};
    const bytes = Buffer.from(JSON.stringify(saved, null, 2), "utf8");
    const entry = await t.documents.upload(WORKBOOK, { buffer: bytes, originalName: "Case-09-inputs.json", mimeType: "text/plain", size: bytes.length }, PREPARER, false, false, false, false, false, true);
    const snapshot = {
      ...records.snapshots[0],
      id: entry.documentId,
      label: "Case 09",
      inputHash: "f".repeat(64),
      file: { documentId: entry.documentId, filename: "Case-09-inputs.json", sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, uploadedAt: entry.uploadedAt },
    };
    await t.workbooks.updateOne({ workbookId: WORKBOOK }, { $push: { "mef.consequenceQuantification.caseRecords.snapshots": snapshot } }).exec();
    const refused = await start({ snapshotId: entry.documentId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 }).expect(400);
    expect(refused.body.message).toBe("The weather trials of this snapshot could not be generated: Weather-trial probabilities must total 1");
    const setup: RcConsequenceRunSetup = (await request(http()).get(`${RUNS}/setup`).query({ snapshotId: entry.documentId }).expect(200)).body;
    expect(setup.trialCount).toBe(0);
    expect(setup.metrics.filter((metric) => metric.runnable).map((metric) => metric.id)).toEqual(["RCM-01", "RCM-02"]);
    expect(praetor.submitted).toEqual([]);
    expect(await listed()).toEqual([]);
  });

  it("fails with the message of the engine and stops the jobs that are left", async () => {
    const snapshotId = await loadPublished();
    praetor.failures = [{ kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[meteorology] wind_speed_m_s must be > 0", details: {} }];
    const { run, result } = await finished({ snapshotId, metricId: "RCM-02", distancesMetres: [8046.7], heightMetres: 0 });
    expect(run).toMatchObject({
      status: "FAILED",
      engineVersion: STAND_IN_ENGINE,
      failure: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[meteorology] wind_speed_m_s must be > 0" },
      progress: null,
    });
    expect(result).toBeNull();
    expect([...praetor.cancelled].sort()).toEqual([`${run.id}-2`, `${run.id}-3`]);
    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: (await recordsNow()).revision, distanceIndex: 0 }).expect(409);
    expect((await filePage(run.id, "input")).text.split("\n")[0]).toBe("OpenRC input for Run 01");
    await request(http()).get(`${RUNS}/${run.id}/files/output`).expect(409);
  });

  it("fails at once when PRAETOR cannot be reached and leaves no job behind", async () => {
    const snapshotId = await loadPublished();
    praetor.down = true;
    const failed: RcConsequenceRun = (await start({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 }).expect(200)).body;
    expect(failed).toMatchObject({
      label: "Run 01",
      status: "FAILED",
      failure: { kind: "TRANSPORT", code: "PRAETOR_UNAVAILABLE", message: "PRAETOR could not be reached at http://praetor.test/q: fetch failed" },
      progress: null,
    });
    expect(praetor.submitted).toEqual([]);
    praetor.down = false;
    const next = await finished({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 });
    expect(next.run).toMatchObject({ label: "Run 02", status: "SUCCEEDED" });
    expect((await listed()).map((run) => [run.label, run.status])).toEqual([
      ["Run 02", "SUCCEEDED"],
      ["Run 01", "FAILED"],
    ]);
  });

  it("pages the input sent to the engine and the output it returned", async () => {
    const snapshotId = await hourlySnapshot();
    const { run } = await finished({ snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 });
    const day = reference.cases[4];
    const first = await filePage(run.id, "input");
    expect(first).toMatchObject({ offset: 0, size: 20 });
    expect(first.text.split("\n")).toHaveLength(20);
    expect(first.text.split("\n").slice(0, 9)).toEqual([
      "OpenRC input for Run 01",
      `Release category: ${RC_PUBLISHED_CATEGORY}`,
      "Consequence metric: 30-day dose at the EAB",
      "Input snapshot: Case 02",
      "Receptor height: 0 m",
      "Weather trials: 24",
      "",
      "===== Request 1 of 3: receptor at 746 m, part 1 of 3 =====",
      "[run]",
    ]);
    const input: string[] = [];
    for (let offset = 0; offset < first.total; offset += first.size) input.push(...(await filePage(run.id, "input", offset)).text.split("\n"));
    expect(input).toHaveLength(first.total);
    const text = input.join("\n");
    day.requests.forEach((entry) => expect(text).toContain(entry.configText.trimEnd()));
    expect(text.endsWith(`===== Weather file of every request =====\n${day.requests[0].metFileText.trimEnd()}`)).toBe(true);

    const head = await filePage(run.id, "output");
    const output: string[] = [];
    for (let offset = 0; offset < head.total; offset += head.size) output.push(...(await filePage(run.id, "output", offset)).text.split("\n"));
    expect(output.slice(0, 7)).toEqual([
      "OpenRC output for Run 01",
      `Release category: ${RC_PUBLISHED_CATEGORY}`,
      "Consequence metric: 30-day dose at the EAB",
      "Input snapshot: Case 02",
      "Receptor height: 0 m",
      "Weather trials: 24",
      `Engine: ${STAND_IN_ENGINE}`,
    ]);
    expect(output.filter((line) => line.startsWith("Note: "))).toEqual(run.notes.map((note) => `Note: ${note.message}`));
    expect(output.filter((line) => line.startsWith("  Realizations     : "))).toEqual(Array.from({ length: 3 }, () => "  Realizations     : 24"));
    expect(output.filter((line) => line.startsWith('    {"index":'))).toHaveLength(72);
    const firstResults = output.indexOf("Results:");
    const closing = output.indexOf("}", firstResults);
    const parsed = JSON.parse(output.slice(firstResults + 1, closing + 1).join("\n"));
    expect(parsed.n_realizations).toBe(24);
    expect(parsed.realizations.map((entry: { tede_msv: number }) => entry.tede_msv).every((dose: number, index: number) => closeTo(dose, day.doses[0].tede_msv?.[index] ?? Number.NaN))).toBe(true);
    await request(http()).get(`${RUNS}/${run.id}/files/other`).expect(400);
    await request(http()).get(`${RUNS}/${run.id}/files/input`).query({ offset: -5 }).expect(400);
    await request(http()).get(`${RUNS}/${run.id}/files/input`).set("x-test-user", "outsider").expect(403);
    expect((await filePage(run.id, "input", first.total + 40)).text).toBe("");
  });

  it("lets only preparers of a draft workbook run, and lets every project member read", async () => {
    const snapshotId = await loadPublished();
    const body = { snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 };
    for (const user of ["reviewer", "viewer", "outsider"]) await start(body, user).expect(403);
    expect(praetor.submitted).toEqual([]);
    const { run } = await finished(body);
    for (const user of ["reviewer", "viewer"]) {
      expect((await request(http()).get(RUNS).set("x-test-user", user).expect(200)).body.runs).toHaveLength(1);
      expect((await request(http()).get(`${RUNS}/${run.id}`).set("x-test-user", user).expect(200)).body.run.id).toBe(run.id);
    }
    await request(http()).get(RUNS).set("x-test-user", "outsider").expect(403);
    await request(http()).get(`${RUNS}/${run.id}`).set("x-test-user", "outsider").expect(403);
    await request(http()).get(`/rc-workbooks/no-such-workbook/consequence-runs`).expect(404);
    await request(http()).get(`${RUNS}/00000000-0000-4000-8000-000000000000`).expect(404);

    await t.workbooks.updateOne({ workbookId: WORKBOOK }, { $set: { "mef.workflowState": "IN_REVIEW" } }).exec();
    expect((await start(body).expect(403)).body.message).toBe("OpenRC runs are locked during review and approval");
    await request(http()).post(`${RUNS}/${run.id}/remove`).send({}).expect(403);
    await request(http()).post(`${RUNS}/${run.id}/record`).send({ baseRevision: (await recordsNow()).revision, distanceIndex: 0 }).expect(403);
    expect((await listed()).map((entry) => entry.id)).toEqual([run.id]);
  });

  it("fails a run that no server follows any more and stops its jobs", async () => {
    await loadPublished();
    await runs.create(ghostRun(1, "RUNNING", new Date(Date.now() - 600000)));
    await runs.create(ghostRun(2, "QUEUED", new Date()));
    await runs.create(ghostRun(3, "SUCCEEDED", new Date(Date.now() - 600000)));
    await service["sweepOrphans"]();
    const after = await listed();
    expect(after.map((run) => [run.label, run.status])).toEqual([
      ["Run 03", "SUCCEEDED"],
      ["Run 02", "QUEUED"],
      ["Run 01", "FAILED"],
    ]);
    expect(after[2].failure).toEqual({
      kind: "BACKEND",
      code: "RUN_INTERRUPTED",
      message: "The server stopped following this run before it finished, for example after a restart. Run it again.",
    });
    expect(praetor.cancelled).toEqual(["ghost-1"]);
  });

  it("holds at most 200 runs in a workbook", async () => {
    const snapshotId = await loadPublished();
    await runs.insertMany(Array.from({ length: 200 }, (_run, index) => ghostRun(index + 1, "CANCELLED", new Date())));
    const body = { snapshotId, metricId: "RCM-01", distancesMetres: [746], heightMetres: 0 };
    expect((await start(body).expect(400)).body.message).toBe("This workbook already holds 200 OpenRC runs. Remove the runs you no longer need");
    await request(http()).post(`${RUNS}/${ghostRun(200, "CANCELLED", new Date()).id}/remove`).send({}).expect(200);
    expect((await finished(body)).run).toMatchObject({ label: "Run 200", status: "SUCCEEDED" });
  });
});
