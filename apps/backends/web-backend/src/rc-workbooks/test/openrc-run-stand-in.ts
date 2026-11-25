import { BadGatewayException } from "@nestjs/common";
import type { PraetorJobState, PraetorJobStatus } from "interfaces-shared-types/execution/praetor-job";
import { execute } from "openrc-node";
import { parseNativeResponse, type NativeJson, type NativeResponse, type NativeStructuredError } from "openrc-node/protocol";

interface StandInJob {
  request: object;
  status: PraetorJobStatus;
  response?: NativeResponse;
}

interface StandInSubmission {
  jobId: string;
  request: object;
}

const STAND_IN_ENGINE = `sha256:${"0123456789abcdef".repeat(4)}`;
const STAND_IN_TIME = "2026-11-12T12:00:00.000Z";

class StandInPraetor {
  readonly submitted: StandInSubmission[] = [];
  readonly cancelled: string[] = [];
  held = false;
  down = false;
  workers: number | null = 1;
  failures: NativeStructuredError[] = [];
  engineVersions: string[] = [STAND_IN_ENGINE];
  private finished = 0;
  private readonly jobs = new Map<string, StandInJob>();

  reset(): void {
    this.submitted.length = 0;
    this.cancelled.length = 0;
    this.held = false;
    this.down = false;
    this.workers = 1;
    this.failures = [];
    this.engineVersions = [STAND_IN_ENGINE];
    this.finished = 0;
    this.jobs.clear();
  }

  private jobOf(jobId: string): StandInJob {
    const job = this.jobs.get(jobId);
    if (job === undefined) throw new BadGatewayException(`PRAETOR refused to report OpenRC job ${jobId} (HTTP 404)`);
    return job;
  }

  private finish(job: StandInJob): void {
    const version = this.engineVersions[this.finished % this.engineVersions.length];
    this.finished += 1;
    const failure = this.failures.shift();
    if (failure !== undefined) {
      job.response = { schemaVersion: "1.0.0", engine: { name: "OPENRC", version }, error: failure };
      job.status = "FAILED";
      return;
    }
    const answer: NativeJson = JSON.parse(execute(JSON.stringify(job.request)));
    const response = parseNativeResponse(answer);
    job.response = { ...response, engine: { name: "OPENRC", version } };
    job.status = response.error === undefined ? "SUCCEEDED" : "FAILED";
  }

  private stateOf(jobId: string, job: StandInJob): PraetorJobState {
    return {
      jobId,
      operation: "execute",
      status: job.status,
      submittedAt: STAND_IN_TIME,
      startedAt: job.status === "QUEUED" ? null : STAND_IN_TIME,
      completedAt: job.response === undefined ? null : STAND_IN_TIME,
      worker: job.status === "QUEUED" ? null : "stand-in",
      attempts: job.status === "QUEUED" ? 0 : 1,
      queuedJobs: [...this.jobs.values()].filter((entry) => entry.status === "QUEUED").length,
      workers: this.workers,
      error: null,
    };
  }

  async submit(request: object, options: { jobId?: string } = {}): Promise<PraetorJobState> {
    if (this.down) throw new BadGatewayException("PRAETOR could not be reached at http://praetor.test/q: fetch failed");
    const jobId = options.jobId ?? `stand-in-${this.jobs.size + 1}`;
    const job: StandInJob = { request, status: "QUEUED" };
    this.jobs.set(jobId, job);
    this.submitted.push({ jobId, request });
    return this.stateOf(jobId, job);
  }

  async state(jobId: string): Promise<PraetorJobState> {
    const job = this.jobOf(jobId);
    if (!this.held && job.status === "RUNNING") this.finish(job);
    else if (!this.held && job.status === "QUEUED") job.status = "RUNNING";
    return this.stateOf(jobId, job);
  }

  async result(jobId: string): Promise<NativeResponse> {
    const response = this.jobOf(jobId).response;
    if (response === undefined) throw new BadGatewayException(`PRAETOR refused to return the result of OpenRC job ${jobId} (HTTP 409)`);
    return response;
  }

  async cancel(jobId: string): Promise<void> {
    this.cancelled.push(jobId);
    const job = this.jobs.get(jobId);
    if (job !== undefined && (job.status === "QUEUED" || job.status === "RUNNING")) job.status = "CANCELLED";
  }
}

export { STAND_IN_ENGINE, StandInPraetor };
