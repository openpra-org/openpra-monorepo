import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import type { Model } from "mongoose";
import { z } from "zod";
import type { RcCaseData, RcCaseRecords } from "interfaces-mef-types/rc/case-records";
import type {
  RcConsequenceRun,
  RcConsequenceRunDetails,
  RcConsequenceRunDistance,
  RcConsequenceRunFailure,
  RcConsequenceRunNuclideDose,
  RcConsequenceRunProgress,
  RcConsequenceRunReceptorKind,
  RcConsequenceRunRecordRequest,
  RcConsequenceRunRequest,
  RcConsequenceRunResult,
  RcConsequenceRunSetup,
  RcConsequenceRunStatus,
  RcConsequenceRunTextPage,
  RcConsequenceRunTrialPage,
} from "interfaces-mef-types/rc/consequence-runs";
import type { RcConsequenceMetric, RcMetricStatistics } from "interfaces-mef-types/rc/metrics";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { praetorJobFinished } from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import { rcMetricOpenRcSupport, rcMetricUnit } from "interfaces-shared-types/rc-workbooks/metrics";
import { cellDoseDistance, evaluatedReceptor, receptorCount, siteReceptorIssues } from "interfaces-shared-types/rc-workbooks/site-receptors";
import type { NativeJson, NativeStructuredError } from "openrc-node/protocol";
import { ProjectsService } from "../projects/projects.service";
import { WorkbookRolesService } from "../workbooks/workbook-roles.service";
import {
  WorkbookOpenRcAdapterError,
  adaptOpenRcMissingDoseCoefficients,
  adaptOpenRcStatistics,
  adaptOpenRcTrialDoses,
  adaptRcCaseRequests,
  type AdaptedOpenRcCase,
  type OpenRcJsonObject,
} from "./openrc-case-adapters";
import { PraetorConsequenceClient } from "./praetor-consequence.client";
import { RcCaseRecordsService } from "./rc-case-records.service";
import {
  RcConsequenceRunRecord,
  type RcConsequenceRunDocument,
  type RcConsequenceRunDoses,
  type RcConsequenceRunJob,
  type RcConsequenceRunOutput,
} from "./rc-consequence-run.schema";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";

interface Actor {
  username: string;
}

interface RunOutcome {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  engineVersion: string | null;
  failure: RcConsequenceRunFailure | null;
  result?: RcConsequenceRunResult;
  doses?: RcConsequenceRunDoses[];
  output?: RcConsequenceRunOutput[];
}

interface FollowedRun {
  id: string;
  jobs: RcConsequenceRunJob[];
  distancesMetres: number[];
  trialCount: number;
  statistics: RcMetricStatistics;
}

interface RunTrialQuery {
  distance?: string;
  offset?: string;
  order?: string;
}

type RunHeader = Pick<
  RcConsequenceRunRecord,
  | "id"
  | "sequence"
  | "categoryId"
  | "snapshotId"
  | "snapshotLabel"
  | "metricId"
  | "metricName"
  | "unit"
  | "receptorKind"
  | "windowSeconds"
  | "statistics"
  | "distancesMetres"
  | "heightMetres"
  | "trialCount"
  | "jobs"
  | "notes"
  | "status"
  | "requestedBy"
  | "requestedAt"
  | "startedAt"
  | "completedAt"
  | "engineVersion"
  | "failure"
  | "progress"
>;

type RunFiles = RunHeader & Pick<RcConsequenceRunRecord, "input" | "output">;

const TRACK_FIRST_POLL_MS = 150;
const TRACK_POLL_MS = 1_500;
const TRACK_HEARTBEAT_MS = 10_000;
const ORPHAN_SWEEP_MS = 30_000;
const ORPHAN_AFTER_MS = 120_000;
const RUN_LIMIT = 200;
const DISTANCE_LIMIT = 100;
const TRIAL_PAGE = 10;
const TEXT_PAGE = 20;
const SEQUENCE_ATTEMPTS = 5;
const DUPLICATE_KEY = 11000;
const FINGERPRINT_PREFIX = "sha256:";
const ENGINE_SEPARATOR = ", ";
const ACTIVE: RcConsequenceRunStatus[] = ["QUEUED", "RUNNING"];
const HEADER_FIELDS = { _id: 0, trials: 0, input: 0, output: 0, doses: 0, result: 0 } as const;
const DETAIL_FIELDS = { _id: 0, trials: 0, input: 0, output: 0, doses: 0 } as const;
const FILE_FIELDS = { _id: 0, trials: 0, doses: 0 } as const;

const startSchema: z.ZodType<RcConsequenceRunRequest> = z
  .object({
    snapshotId: z.string().uuid("Choose an input snapshot"),
    metricId: z.string().min(1, "Choose a consequence metric").max(40, "Choose a consequence metric"),
    distancesMetres: z
      .array(z.number("Receptor distances must be numbers in metres").finite().positive("Receptor distances must be greater than 0 m"))
      .min(1, "Give at least one receptor distance")
      .max(DISTANCE_LIMIT, `A run takes at most ${DISTANCE_LIMIT} receptor distances`),
    heightMetres: z.number("Give the receptor height in metres").finite().nonnegative("The receptor height cannot be negative"),
  })
  .strict();

const recordSchema: z.ZodType<RcConsequenceRunRecordRequest> = z
  .object({
    baseRevision: z.number().int().nonnegative(),
    distanceIndex: z.number().int().nonnegative(),
  })
  .strict();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : iso(value));

const issueText = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((issue) => issue.message)
    .join("; ");

const runLabel = (sequence: number): string => `Run ${String(sequence).padStart(2, "0")}`;

const numberText = (value: number): string => String(value === 0 ? 0 : value);

const active = (status: RcConsequenceRunStatus): boolean => ACTIVE.includes(status);

const duplicateKey = (error: Error): boolean => "code" in error && error.code === DUPLICATE_KEY;

const objectOf = (value: NativeJson | undefined): OpenRcJsonObject | undefined =>
  value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;

const finiteOrNull = (value: NativeJson | undefined): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const receptorKindOf = (metric: RcConsequenceMetric): RcConsequenceRunReceptorKind | null =>
  metric.receptor.kind === "EAB_MAXIMUM" || metric.receptor.kind === "DISTANCE_PROFILE" ? metric.receptor.kind : null;

const metricIssue = (metric: RcConsequenceMetric): string => {
  const support = rcMetricOpenRcSupport(metric);
  if (support.status !== "YES") return support.reason;
  if (metric.window === undefined) return "The metric has no exposure window.";
  return "";
};

const metricName = (metric: RcConsequenceMetric): string => {
  const name = metric.name.trim();
  return name.length > 0 ? name : metric.id;
};

const siteDistances = (data: RcCaseData): number[] => {
  const site = data.site;
  const geometry = site?.geometry;
  if (site === undefined || geometry === undefined || siteReceptorIssues(site.settings, geometry).length > 0) return [];
  const found: (number | undefined)[] =
    geometry.kind === "cells"
      ? geometry.radiiKm.map((_radius, band) => cellDoseDistance(geometry, site.settings, band))
      : Array.from({ length: receptorCount(geometry) }, (_point, index) => evaluatedReceptor(geometry, site.settings, index).distanceMetres);
  const distances = new Set<number>();
  for (const distance of found) {
    if (distance !== undefined && Number.isFinite(distance) && distance > 0) distances.add(Number(distance.toPrecision(12)));
  }
  return [...distances].sort((left, right) => left - right);
};

const toRun = (record: RunHeader): RcConsequenceRun => ({
  id: record.id,
  label: runLabel(record.sequence),
  categoryId: record.categoryId,
  snapshotId: record.snapshotId,
  snapshotLabel: record.snapshotLabel,
  metricId: record.metricId,
  metricName: record.metricName,
  unit: record.unit,
  receptorKind: record.receptorKind,
  windowSeconds: record.windowSeconds,
  statistics: record.statistics,
  distancesMetres: [...record.distancesMetres],
  heightMetres: record.heightMetres,
  trialCount: record.trialCount,
  jobCount: record.jobs.length,
  notes: record.notes.map((note) => ({ code: note.code, message: note.message })),
  status: record.status,
  requestedBy: record.requestedBy,
  requestedAt: iso(record.requestedAt),
  startedAt: isoOrNull(record.startedAt),
  completedAt: isoOrNull(record.completedAt),
  engineVersion: record.engineVersion,
  failure: record.failure === null ? null : { kind: record.failure.kind, code: record.failure.code, message: record.failure.message },
  progress: active(record.status) ? record.progress : null,
});

const failureOf = (error: NativeStructuredError | undefined): RcConsequenceRunFailure =>
  error === undefined
    ? { kind: "EXECUTION_ERROR", code: "OPENRC_INVALID_RESPONSE", message: "OpenRC returned neither a result nor an error." }
    : { kind: error.kind, code: error.code, message: error.message };

const nuclideDosesOf = (summaries: readonly OpenRcJsonObject[]): RcConsequenceRunNuclideDose[] | undefined => {
  const doses = new Map<string, number>();
  for (const summary of summaries) {
    const breakdown = objectOf(summary["breakdown_msv"]);
    if (breakdown === undefined) return undefined;
    for (const [nuclide, value] of Object.entries(breakdown)) {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      doses.set(nuclide, (doses.get(nuclide) ?? 0) + value / 1000);
    }
  }
  return [...doses]
    .map(([nuclide, doseSv]) => ({ nuclide, doseSv }))
    .sort((left, right) => right.doseSv - left.doseSv || left.nuclide.localeCompare(right.nuclide));
};

const groundDepositionOf = (summaries: readonly OpenRcJsonObject[]): number | undefined => {
  let total = 0;
  for (const summary of summaries) {
    const value = summary["ground_deposition_bq_m2"];
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    total += value;
  }
  return total;
};

const dispersionOf = (summary: OpenRcJsonObject | undefined, trialCount: number): (number | null)[] => {
  if (trialCount === 1) return [finiteOrNull(summary?.["chi_over_q_s_m3"])];
  const realizations = summary?.["realizations"];
  return Array.from({ length: trialCount }, (_trial, index) =>
    Array.isArray(realizations) ? finiteOrNull(objectOf(realizations[index])?.["chi_over_q_s_m3"]) : null,
  );
};

const distanceResult = (
  distanceMetres: number,
  parts: readonly OpenRcJsonObject[],
  trialCount: number,
  wanted: RcMetricStatistics,
): { distance: RcConsequenceRunDistance; doses: RcConsequenceRunDoses } => {
  const dosesSv = adaptOpenRcTrialDoses(parts, trialCount);
  const summaries = parts.flatMap((part) => {
    const summary = objectOf(part["results"]);
    return summary === undefined ? [] : [summary];
  });
  const groundDeposition = groundDepositionOf(summaries);
  const nuclideDoses = nuclideDosesOf(summaries);
  return {
    distance: {
      distanceMetres,
      statistics: adaptOpenRcStatistics(dosesSv, wanted),
      minimumSv: dosesSv.reduce((least, dose) => Math.min(least, dose), dosesSv[0]),
      maximumSv: dosesSv.reduce((most, dose) => Math.max(most, dose), dosesSv[0]),
      ...(groundDeposition === undefined ? {} : { groundDepositionBqPerSquareMetre: groundDeposition }),
      ...(nuclideDoses === undefined ? {} : { nuclideDoses }),
    },
    doses: { dosesSv, dispersion: dispersionOf(summaries[0], trialCount) },
  };
};

const textLines = (text: string): string[] => {
  const rows = text.split("\r\n").join("\n").split("\n");
  if (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
  return rows;
};

const resultLines = (resultsText: string): string[] => {
  const parsed: NativeJson = JSON.parse(resultsText);
  const summary = objectOf(parsed);
  if (summary === undefined) return [resultsText];
  const entries = Object.entries(summary);
  const rows = ["{"];
  entries.forEach(([key, value], index) => {
    const comma = index === entries.length - 1 ? "" : ",";
    if (key === "realizations" && Array.isArray(value)) {
      rows.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((row, at) => rows.push(`    ${stringifyJson(row)}${at === value.length - 1 ? "" : ","}`));
      rows.push(`  ]${comma}`);
      return;
    }
    rows.push(`  ${JSON.stringify(key)}: ${stringifyJson(value)}${comma}`);
  });
  rows.push("}");
  return rows;
};

const headLines = (run: RunFiles, title: string): string[] => [
  `${title} for ${runLabel(run.sequence)}`,
  `Release category: ${run.categoryId}`,
  `Consequence metric: ${run.metricName}`,
  `Input snapshot: ${run.snapshotLabel}`,
  `Receptor height: ${numberText(run.heightMetres)} m`,
  `Weather trials: ${run.trialCount}`,
];

const requestTitle = (run: RunFiles, index: number): string => {
  const job = run.jobs[index];
  const parts = run.jobs.filter((candidate) => candidate.distanceIndex === job.distanceIndex).length;
  const part = parts === 1 ? "" : `, part ${job.part + 1} of ${parts}`;
  return `===== Request ${index + 1} of ${run.jobs.length}: receptor at ${numberText(run.distancesMetres[job.distanceIndex])} m${part} =====`;
};

const inputLines = (run: RunFiles): string[] => [
  ...headLines(run, "OpenRC input"),
  ...run.jobs.flatMap((_job, index) => ["", requestTitle(run, index), ...textLines(run.input.configTexts[index] ?? "")]),
  "",
  "===== Weather file of every request =====",
  ...textLines(run.input.metFileText),
];

const outputLines = (run: RunFiles): string[] => [
  ...headLines(run, "OpenRC output"),
  `Engine: ${run.engineVersion ?? "not reported"}`,
  ...run.notes.map((note) => `Note: ${note.message}`),
  ...run.jobs.flatMap((_job, index) => {
    const output = run.output[index];
    if (output === undefined) return [];
    return [
      "",
      requestTitle(run, index),
      `Engine: ${output.engineVersion ?? "not reported"}`,
      ...textLines(output.console),
      "",
      "Results:",
      ...resultLines(output.resultsText),
    ];
  }),
];

const engineList = (versions: Iterable<string | null>): string | null => {
  const known = new Set<string>();
  for (const version of versions) {
    if (version !== null) known.add(version);
  }
  return known.size === 0 ? null : [...known].sort().join(ENGINE_SEPARATOR);
};

const versionText = (engineVersion: string | null): string => {
  if (engineVersion === null) return "OpenRC";
  const builds = engineVersion.split(ENGINE_SEPARATOR).map((version) => {
    const digits = version.startsWith(FINGERPRINT_PREFIX) ? version.slice(FINGERPRINT_PREFIX.length) : version;
    return digits.slice(0, 12);
  });
  return `OpenRC ${builds.join(ENGINE_SEPARATOR)}`;
};

@Injectable()
class RcConsequenceRunsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RcConsequenceRunsService.name);
  private readonly following = new Set<string>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(RcConsequenceRunRecord.name) private readonly runs: Model<RcConsequenceRunDocument>,
    @InjectModel(RcWorkbook.name) private readonly workbooks: Model<RcWorkbookDocument>,
    private readonly projects: ProjectsService,
    private readonly roles: WorkbookRolesService,
    private readonly cases: RcCaseRecordsService,
    private readonly praetor: PraetorConsequenceClient,
  ) {}

  onModuleInit(): void {
    this.sweeper = setInterval(() => {
      void this.sweepOrphans().catch((error: Error) => this.logger.error(`OpenRC run sweep failed: ${error.message}`));
    }, ORPHAN_SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper !== null) clearInterval(this.sweeper);
  }

  private async authorize(workbookId: string, actor: Actor, write: boolean): Promise<void> {
    const workbook = await this.workbooks.findOne({ workbookId }).exec();
    if (workbook === null) throw new NotFoundException("RC workbook not found");
    const access = await this.projects.resolveAccess(workbook.projectId, actor);
    if (!write) return;
    const roles = await this.roles.resolveEffectiveRoles(workbookId, actor.username);
    if (access.role === "viewer" || !roles.some((role) => role === "preparer" || role === "co_preparer")) {
      throw new ForbiddenException("Only preparers can run OpenRC");
    }
    const mef = workbook.mef as RadiologicalConsequenceAnalysis;
    if (!["DRAFT", "REVISION_REQUIRED"].includes(mef.workflowState ?? "DRAFT")) {
      throw new ForbiddenException("OpenRC runs are locked during review and approval");
    }
  }

  private async header(workbookId: string, runId: string): Promise<RunHeader> {
    const run = await this.runs.findOne({ id: runId, workbookId }).select(HEADER_FIELDS).lean().exec();
    if (run === null) throw new NotFoundException("OpenRC run not found");
    return run;
  }

  private async stopJobs(jobIds: Iterable<string>): Promise<void> {
    await Promise.all([...jobIds].map((jobId) => this.praetor.cancel(jobId).catch(() => undefined)));
  }

  private async finish(runId: string, outcome: RunOutcome): Promise<boolean> {
    const completedAt = new Date();
    const open = { id: runId, status: { $in: ACTIVE } };
    if (outcome.status !== "CANCELLED") {
      await this.runs.updateOne({ ...open, startedAt: null }, { $set: { startedAt: completedAt } }).exec();
    }
    const changed = await this.runs
      .updateOne(open, {
        $set: {
          status: outcome.status,
          completedAt,
          engineVersion: outcome.engineVersion,
          failure: outcome.failure,
          progress: null,
          ...(outcome.result === undefined ? {} : { result: outcome.result }),
          ...(outcome.doses === undefined ? {} : { doses: outcome.doses }),
          ...(outcome.output === undefined ? {} : { output: outcome.output }),
        },
      })
      .exec();
    return changed.matchedCount > 0;
  }

  private async sweepOrphans(): Promise<void> {
    const stale = await this.runs
      .find({ status: { $in: ACTIVE }, trackedAt: { $lt: new Date(Date.now() - ORPHAN_AFTER_MS) } })
      .select({ _id: 0, id: 1, jobs: 1 })
      .lean()
      .exec();
    for (const run of stale) {
      if (this.following.has(run.id)) continue;
      await this.stopJobs(run.jobs.map((job) => job.jobId));
      await this.finish(run.id, {
        status: "FAILED",
        engineVersion: null,
        failure: {
          kind: "BACKEND",
          code: "RUN_INTERRUPTED",
          message: "The server stopped following this run before it finished, for example after a restart. Run it again.",
        },
      });
    }
  }

  private track(run: FollowedRun): void {
    this.following.add(run.id);
    void this.follow(run)
      .catch(async (error: Error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`OpenRC run ${run.id} failed while it was followed: ${message}`);
        await this.stopJobs(run.jobs.map((job) => job.jobId));
        await this.finish(run.id, {
          status: "FAILED",
          engineVersion: null,
          failure: { kind: "BACKEND", code: "RUN_FOLLOW_FAILED", message: `The server could not finish this run: ${message}` },
        }).catch((stored: Error) => this.logger.error(`OpenRC run ${run.id} failure could not be stored: ${stored.message}`));
      })
      .finally(() => this.following.delete(run.id));
  }

  private async follow(run: FollowedRun): Promise<void> {
    const pending = new Set(run.jobs.map((job) => job.jobId));
    const results = new Map<string, OpenRcJsonObject>();
    const engines = new Map<string, string | null>();
    let started = false;
    let beat = 0;
    let pause = TRACK_FIRST_POLL_MS;
    while (pending.size > 0) {
      const states = await Promise.all([...pending].map((jobId) => this.praetor.state(jobId)));
      let queuedJobs: number | null = null;
      let workers: number | null = null;
      for (const state of states) {
        queuedJobs = state.queuedJobs ?? queuedJobs;
        workers = state.workers ?? workers;
        if (!started && state.status !== "QUEUED") {
          started = true;
          await this.runs.updateOne({ id: run.id, status: "QUEUED" }, { $set: { status: "RUNNING", startedAt: new Date() } }).exec();
        }
        if (!praetorJobFinished(state.status)) continue;
        pending.delete(state.jobId);
        if (state.status === "CANCELLED") {
          await this.stopJobs(pending);
          await this.finish(run.id, { status: "CANCELLED", engineVersion: engineList(engines.values()), failure: null });
          return;
        }
        const response = await this.praetor.result(state.jobId);
        engines.set(state.jobId, response.engine?.version ?? null);
        if (response.error !== undefined || response.result === undefined) {
          await this.stopJobs(pending);
          await this.finish(run.id, { status: "FAILED", engineVersion: engineList(engines.values()), failure: failureOf(response.error) });
          return;
        }
        results.set(state.jobId, response.result);
      }
      const now = Date.now();
      const beats = now - beat >= TRACK_HEARTBEAT_MS;
      if (beats) beat = now;
      const progress: RcConsequenceRunProgress = { completed: run.jobs.length - pending.size, total: run.jobs.length, queuedJobs, workers };
      const kept = await this.runs
        .updateOne({ id: run.id, status: { $in: ACTIVE } }, { $set: { progress, ...(beats ? { trackedAt: new Date(now) } : {}) } })
        .exec();
      if (kept.matchedCount === 0) {
        await this.stopJobs(pending);
        return;
      }
      if (pending.size > 0) {
        await delay(pause);
        pause = Math.min(TRACK_POLL_MS, Math.round(pause * 1.5));
      }
    }
    await this.complete(run, results, engines);
  }

  private async complete(run: FollowedRun, results: ReadonlyMap<string, OpenRcJsonObject>, engines: ReadonlyMap<string, string | null>): Promise<void> {
    const engineVersion = engineList(engines.values());
    const ordered = run.jobs.flatMap((job) => {
      const result = results.get(job.jobId);
      return result === undefined ? [] : [{ job, result }];
    });
    try {
      const computed = run.distancesMetres.map((distanceMetres, distanceIndex) =>
        distanceResult(
          distanceMetres,
          ordered.filter((entry) => entry.job.distanceIndex === distanceIndex).map((entry) => entry.result),
          run.trialCount,
          run.statistics,
        ),
      );
      const missing = adaptOpenRcMissingDoseCoefficients(ordered.map((entry) => entry.result));
      await this.finish(run.id, {
        status: "SUCCEEDED",
        engineVersion,
        failure: null,
        result: {
          distances: computed.map((entry) => entry.distance),
          ...(missing === undefined ? {} : { missingDoseCoefficients: missing }),
        },
        doses: computed.map((entry) => entry.doses),
        output: ordered.map(({ job, result }) => ({
          console: typeof result["console"] === "string" ? result["console"] : "",
          resultsText: stringifyJson(result["results"] ?? null) ?? "null",
          engineVersion: engines.get(job.jobId) ?? null,
        })),
      });
    } catch (error) {
      if (!(error instanceof WorkbookOpenRcAdapterError)) throw error;
      await this.finish(run.id, { status: "FAILED", engineVersion, failure: { kind: "RESULT_ERROR", code: error.code, message: error.message } });
    }
  }

  private async nextSequence(workbookId: string): Promise<number> {
    const last = await this.runs.findOne({ workbookId }).select({ _id: 0, sequence: 1 }).sort({ sequence: -1 }).lean().exec();
    return (last?.sequence ?? 0) + 1;
  }

  async setup(workbookId: string, snapshotId: string, actor: Actor): Promise<RcConsequenceRunSetup> {
    await this.authorize(workbookId, actor, false);
    const { summary, data, trials } = await this.cases.runCase(workbookId, snapshotId, actor);
    return {
      snapshotId: summary.id,
      trialCount: trials.length,
      heightMetres: data.site?.settings.receptorHeightMetres ?? null,
      distancesMetres: siteDistances(data),
      metrics: (data.metrics ?? []).map((metric) => {
        const reason = metricIssue(metric);
        return { id: metric.id, name: metricName(metric), receptorKind: receptorKindOf(metric), runnable: reason.length === 0, reason };
      }),
    };
  }

  async list(workbookId: string, actor: Actor): Promise<{ runs: RcConsequenceRun[] }> {
    await this.authorize(workbookId, actor, false);
    const runs = await this.runs.find({ workbookId }).select(HEADER_FIELDS).sort({ sequence: -1 }).lean().exec();
    return { runs: runs.map(toRun) };
  }

  async details(workbookId: string, runId: string, actor: Actor): Promise<RcConsequenceRunDetails> {
    await this.authorize(workbookId, actor, false);
    const run = await this.runs.findOne({ id: runId, workbookId }).select(DETAIL_FIELDS).lean().exec();
    if (run === null) throw new NotFoundException("OpenRC run not found");
    return { run: toRun(run), result: run.status === "SUCCEEDED" ? run.result : null };
  }

  async start(workbookId: string, body: RcConsequenceRunRequest, actor: Actor): Promise<RcConsequenceRun> {
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(issueText(parsed.error));
    await this.authorize(workbookId, actor, true);
    const distancesMetres = [...parsed.data.distancesMetres].sort((left, right) => left - right);
    if (new Set(distancesMetres).size !== distancesMetres.length) throw new BadRequestException("Give each receptor distance once");
    if ((await this.runs.countDocuments({ workbookId }).exec()) >= RUN_LIMIT) {
      throw new BadRequestException(`This workbook already holds ${RUN_LIMIT} OpenRC runs. Remove the runs you no longer need`);
    }
    const { summary, data, trials, trialIssue } = await this.cases.runCase(workbookId, parsed.data.snapshotId, actor);
    if (trialIssue.length > 0) throw new BadRequestException(`The weather trials of this snapshot could not be generated: ${trialIssue}`);
    const metric = (data.metrics ?? []).find((candidate) => candidate.id === parsed.data.metricId);
    if (metric === undefined) throw new BadRequestException("Choose a consequence metric from the selected input snapshot");
    const receptorKind = receptorKindOf(metric);
    const reason = metricIssue(metric);
    if (reason.length > 0 || receptorKind === null || metric.window === undefined) {
      throw new BadRequestException(`OpenRC cannot quantify the metric '${metricName(metric)}': ${reason}`);
    }
    if (receptorKind === "EAB_MAXIMUM" && distancesMetres.length !== 1) {
      throw new BadRequestException("A dose at the EAB takes one receptor distance");
    }
    let adapted: AdaptedOpenRcCase[];
    try {
      adapted = distancesMetres.map((distanceMetres) =>
        adaptRcCaseRequests({
          caseData: data,
          metricId: metric.id,
          receptor: { distanceMetres, heightMetres: parsed.data.heightMetres },
          trials,
        }),
      );
    } catch (error) {
      if (error instanceof WorkbookOpenRcAdapterError) throw new BadRequestException(error.message);
      throw error;
    }
    const id = randomUUID();
    const requests = adapted.flatMap((entry, distanceIndex) => entry.requests.map((request, part) => ({ request, distanceIndex, part })));
    const jobs: RcConsequenceRunJob[] = requests.map((entry, index) => ({
      jobId: `${id}-${index + 1}`,
      distanceIndex: entry.distanceIndex,
      part: entry.part,
    }));
    const requestedAt = new Date();
    const record: Omit<RcConsequenceRunRecord, "sequence"> = {
      id,
      workbookId,
      categoryId: summary.categoryId,
      snapshotId: summary.id,
      snapshotLabel: summary.label,
      metricId: metric.id,
      metricName: metricName(metric),
      unit: rcMetricUnit(metric),
      receptorKind,
      windowSeconds: metric.window.seconds,
      statistics: metric.statistics,
      distancesMetres,
      heightMetres: parsed.data.heightMetres,
      trialCount: trials.length,
      jobs,
      notes: adapted[0].notes.map((note) => ({ code: note.code, message: note.message })),
      status: "QUEUED",
      requestedBy: actor.username,
      requestedAt,
      startedAt: null,
      completedAt: null,
      trackedAt: requestedAt,
      engineVersion: null,
      failure: null,
      progress: { completed: 0, total: jobs.length, queuedJobs: null, workers: null },
      result: null,
      trials: [...trials],
      input: { metFileText: adapted[0].requests[0].request.metFileText, configTexts: requests.map((entry) => entry.request.request.configText) },
      output: [],
      doses: [],
    };
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.runs.create({ ...record, sequence: await this.nextSequence(workbookId) });
        break;
      } catch (error) {
        if (attempt >= SEQUENCE_ATTEMPTS || !(error instanceof Error) || !duplicateKey(error)) throw error;
      }
    }
    const submitted: string[] = [];
    try {
      for (const [index, entry] of requests.entries()) {
        await this.praetor.submit(entry.request, { jobId: jobs[index].jobId });
        submitted.push(jobs[index].jobId);
      }
    } catch (error) {
      await this.stopJobs(submitted);
      await this.finish(id, {
        status: "FAILED",
        engineVersion: null,
        failure: { kind: "TRANSPORT", code: "PRAETOR_UNAVAILABLE", message: error instanceof Error ? error.message : String(error) },
      });
      return toRun(await this.header(workbookId, id));
    }
    const queued = toRun(await this.header(workbookId, id));
    this.track({ id, jobs, distancesMetres, trialCount: trials.length, statistics: metric.statistics });
    return queued;
  }

  async cancel(workbookId: string, runId: string, actor: Actor): Promise<RcConsequenceRun> {
    await this.authorize(workbookId, actor, true);
    const run = await this.header(workbookId, runId);
    if (active(run.status)) {
      await this.stopJobs(run.jobs.map((job) => job.jobId));
      await this.finish(runId, { status: "CANCELLED", engineVersion: null, failure: null });
    }
    return toRun(await this.header(workbookId, runId));
  }

  async remove(workbookId: string, runId: string, actor: Actor): Promise<{ removed: string }> {
    await this.authorize(workbookId, actor, true);
    const run = await this.header(workbookId, runId);
    if (active(run.status)) throw new ConflictException("Cancel the run before removing it");
    await this.runs.deleteOne({ id: runId, workbookId }).exec();
    return { removed: runId };
  }

  async trials(workbookId: string, runId: string, query: RunTrialQuery, actor: Actor): Promise<RcConsequenceRunTrialPage> {
    await this.authorize(workbookId, actor, false);
    const distanceIndex = Number(query.distance ?? "0");
    const offset = Number(query.offset ?? "0");
    const order = query.order ?? "trial";
    if (!Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException("Use a nonnegative page offset");
    if (order !== "trial" && order !== "dose") throw new BadRequestException("Order the trials by trial or by dose");
    const run = await this.runs
      .findOne({ id: runId, workbookId })
      .select({ _id: 0, id: 1, status: 1, distancesMetres: 1, trials: 1, doses: 1 })
      .lean()
      .exec();
    if (run === null) throw new NotFoundException("OpenRC run not found");
    if (run.status !== "SUCCEEDED") throw new ConflictException("This run has no doses");
    const doses = Number.isSafeInteger(distanceIndex) ? run.doses[distanceIndex] : undefined;
    if (doses === undefined) throw new BadRequestException("Choose a receptor distance of this run");
    const indices = run.trials.map((_trial, index) => index);
    if (order === "dose") indices.sort((left, right) => doses.dosesSv[right] - doses.dosesSv[left] || left - right);
    return {
      distanceMetres: run.distancesMetres[distanceIndex],
      total: indices.length,
      offset,
      size: TRIAL_PAGE,
      rows: indices.slice(offset, offset + TRIAL_PAGE).map((index) => {
        const trial = run.trials[index];
        return {
          trialId: trial.id,
          start: trial.source === "constant" ? "Constant" : `Day ${trial.day}, period ${trial.period}`,
          selectionGroup: trial.selectionGroup,
          stabilityClass: trial.stabilityClass,
          windSpeedMetresPerSecond: trial.windSpeedMetresPerSecond,
          windTowardDegrees: trial.windTowardDegrees,
          mixingHeightMetres: trial.mixingHeightMetres,
          doseSv: doses.dosesSv[index],
          dispersionSecondsPerCubicMetre: doses.dispersion[index] ?? null,
        };
      }),
    };
  }

  async file(workbookId: string, runId: string, kind: string, offsetText: string, actor: Actor): Promise<RcConsequenceRunTextPage> {
    await this.authorize(workbookId, actor, false);
    const offset = Number(offsetText);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new BadRequestException("Use a nonnegative page offset");
    if (kind !== "input" && kind !== "output") throw new BadRequestException("Choose the input or the output of the run");
    const run = await this.runs.findOne({ id: runId, workbookId }).select(FILE_FIELDS).lean().exec();
    if (run === null) throw new NotFoundException("OpenRC run not found");
    if (kind === "output" && run.status !== "SUCCEEDED") throw new ConflictException("This run has no output");
    const rows = kind === "input" ? inputLines(run) : outputLines(run);
    return { text: rows.slice(offset, offset + TEXT_PAGE).join("\n"), offset, total: rows.length, size: TEXT_PAGE };
  }

  async record(workbookId: string, runId: string, body: RcConsequenceRunRecordRequest, actor: Actor): Promise<RcCaseRecords> {
    const parsed = recordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Give the case record revision and the receptor distance to record");
    await this.authorize(workbookId, actor, true);
    const run = await this.runs.findOne({ id: runId, workbookId }).select(FILE_FIELDS).lean().exec();
    if (run === null) throw new NotFoundException("OpenRC run not found");
    if (run.status !== "SUCCEEDED" || run.result === null) throw new ConflictException("Only a finished run can be recorded");
    const row = run.result.distances[parsed.data.distanceIndex];
    if (row === undefined) throw new BadRequestException("Choose a receptor distance of this run");
    const label = runLabel(run.sequence);
    return this.cases.saveCalculatedResult(
      workbookId,
      {
        baseRevision: parsed.data.baseRevision,
        snapshotId: run.snapshotId,
        metricId: run.metricId,
        statistics: row.statistics,
        ...(run.receptorKind === "DISTANCE_PROFILE"
          ? { profile: run.result.distances.map((entry) => ({ distanceMetres: entry.distanceMetres, statistics: entry.statistics })) }
          : {}),
        calculation: {
          engine: "OPENRC",
          engineVersion: run.engineVersion ?? "not reported",
          runId: run.id,
          runLabel: label,
          distanceMetres: row.distanceMetres,
          heightMetres: run.heightMetres,
          trialCount: run.trialCount,
        },
        version: versionText(run.engineVersion),
        reference: label,
        filename: `OpenRC-${label.split(" ").join("-")}-output.txt`,
        outputText: `${[...inputLines(run), "", ...outputLines(run)].join("\n")}\n`,
      },
      actor,
    );
  }
}

export { RcConsequenceRunsService };
export type { RunTrialQuery };
