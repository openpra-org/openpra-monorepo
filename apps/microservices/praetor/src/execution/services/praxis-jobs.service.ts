import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Channel, ChannelModel } from "amqplib";
import { randomUUID } from "node:crypto";
import {
  isPraetorJobId,
  praetorJobFinished,
  praetorJobTimeout,
  PRAETOR_JOB_OPERATIONS,
  type PraetorJobOperation,
  type PraetorJobState,
} from "interfaces-shared-types/execution/praetor-job";
import { parseNativeResponse, type NativeResponse, type NativeStructuredError } from "praxis-node/protocol";
import { QueueConfigFactory, QueueService, RabbitMQChannelModelService, type QueueConfig } from "../../shared";
import { PraxisJobStore } from "../praxis-job-store";

interface PraxisJobRequest {
  jobId?: string;
  operation: PraetorJobOperation;
  request: object;
  timeoutMs?: number;
}

type PraxisJobState = PraetorJobState<NativeStructuredError>;

const POLL_FIRST_MS = 100;
const POLL_LONGEST_MS = 1_000;

function staleAfter(): number {
  const value = Number(process.env["PRAETOR_JOB_STALE_MS"] ?? 300_000);
  return Number.isSafeInteger(value) && value > 0 ? value : 300_000;
}

function failure(code: string, message: string, details: Record<string, string | number | null> = {}): NativeStructuredError {
  return { kind: "EXECUTION_ERROR", code, message, details };
}

function errorResponse(error: NativeStructuredError): NativeResponse {
  return { schemaVersion: "1.0.0", error };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

@Injectable()
class PraxisJobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PraxisJobsService.name);
  private readonly config: QueueConfig;
  private readonly cancelExchange: string;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connecting: Promise<Channel> | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmq: RabbitMQChannelModelService,
    queueConfigFactory: QueueConfigFactory,
    private readonly store: PraxisJobStore,
  ) {
    this.config = queueConfigFactory.createPraxisJobQueueConfig();
    this.cancelExchange = queueConfigFactory.praxisCancelExchange();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureChannel();
    this.logger.debug(`PRAXIS jobs publish to ${this.config.name}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.channelModel?.close().catch(() => undefined);
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel !== null) return this.channel;
    if (this.connecting !== null) return this.connecting;
    this.connecting = (async () => {
      const model = await this.rabbitmq.getChannelModel(PraxisJobsService.name);
      const channel = await this.rabbitmq.getChannel(model, PraxisJobsService.name);
      await this.queueService.setupQueue(this.config, channel);
      await channel.assertExchange(this.cancelExchange, "fanout", { durable: true });
      const reset = (): void => {
        if (this.channel === channel) {
          this.channel = null;
          this.channelModel = null;
        }
      };
      channel.on("close", reset);
      channel.on("error", reset);
      model.on("close", reset);
      model.on("error", reset);
      this.channelModel = model;
      this.channel = channel;
      return channel;
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async submit(body: PraxisJobRequest): Promise<PraxisJobState> {
    if (body === null || typeof body !== "object") throw new BadRequestException("A PRAXIS job needs an operation and a request.");
    if (!PRAETOR_JOB_OPERATIONS.includes(body.operation)) throw new BadRequestException("A PRAXIS job operation is execute or validate.");
    if (body.request === null || typeof body.request !== "object" || Array.isArray(body.request)) {
      throw new BadRequestException("A PRAXIS job needs a versioned request object.");
    }
    if (body.jobId !== undefined && !isPraetorJobId(body.jobId)) throw new BadRequestException("Invalid PRAXIS job id.");
    const ceiling = praetorJobTimeout();
    const timeoutMs = body.timeoutMs ?? ceiling;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > ceiling) {
      throw new BadRequestException(`A PRAXIS job timeout must be between 1 and ${ceiling} ms.`);
    }
    const jobId = body.jobId ?? randomUUID();
    const existing = await this.store.submission(jobId);
    if (existing !== undefined) return this.state(jobId);
    const submittedAt = new Date().toISOString();
    await this.store.putInput(jobId, { operation: body.operation, request: body.request, timeoutMs });
    await this.store.putSubmission({ jobId, operation: body.operation, submittedAt, timeoutMs });
    const channel = await this.ensureChannel();
    const published = channel.publish(
      this.config.exchange.name,
      this.config.exchange.routingKey,
      Buffer.from(JSON.stringify({ jobId })),
      { persistent: true, messageId: jobId, contentType: "application/json" },
    );
    if (!published) this.logger.warn(`The PRAXIS job queue is applying back pressure for ${jobId}`);
    return this.state(jobId);
  }

  private async queueCounts(): Promise<{ queuedJobs: number | null; workers: number | null }> {
    try {
      const channel = await this.ensureChannel();
      const checked = await channel.checkQueue(this.config.name);
      return { queuedJobs: checked.messageCount, workers: checked.consumerCount };
    } catch (error) {
      this.logger.warn(`Could not read the PRAXIS job queue: ${error instanceof Error ? error.message : String(error)}`);
      return { queuedJobs: null, workers: null };
    }
  }

  async state(jobId: string): Promise<PraxisJobState> {
    if (!isPraetorJobId(jobId)) throw new BadRequestException("Invalid PRAXIS job id.");
    const submission = await this.store.submission(jobId);
    if (submission === undefined) throw new NotFoundException(`PRAXIS job ${jobId} was not found.`);
    const [running, done, counts] = await Promise.all([this.store.running(jobId), this.store.done(jobId), this.queueCounts()]);
    const base = {
      jobId,
      operation: submission.operation,
      submittedAt: submission.submittedAt,
      startedAt: running?.startedAt ?? null,
      worker: running?.worker ?? null,
      attempts: running?.attempts ?? 0,
      queuedJobs: counts.queuedJobs,
      workers: counts.workers,
    };
    if (done !== undefined) {
      return { ...base, status: done.status, completedAt: done.completedAt, worker: done.worker ?? base.worker, error: done.error };
    }
    if (running !== undefined) {
      const silentFor = Date.now() - Date.parse(running.heartbeatAt);
      if (silentFor > staleAfter()) {
        const error = failure(
          "PRAETOR_WORKER_LOST",
          `The PRAETOR worker ${running.worker} stopped reporting on this job ${Math.round(silentFor / 1000)} s ago, after attempt ${running.attempts}.`,
          { worker: running.worker, attempts: running.attempts },
        );
        const completedAt = new Date().toISOString();
        await this.store.putDone(jobId, { status: "FAILED", completedAt, worker: running.worker, error });
        return { ...base, status: "FAILED", completedAt, error };
      }
      return { ...base, status: "RUNNING", completedAt: null, error: null };
    }
    return { ...base, status: "QUEUED", completedAt: null, error: null };
  }

  async result(jobId: string): Promise<NativeResponse> {
    const state = await this.state(jobId);
    if (!praetorJobFinished(state.status)) throw new ConflictException(`PRAXIS job ${jobId} is ${state.status.toLowerCase()}.`);
    const output = await this.store.output(jobId);
    if (output === undefined) {
      return errorResponse(state.error ?? failure("PRAETOR_NO_OUTPUT", `PRAXIS job ${jobId} ended as ${state.status.toLowerCase()} without an output.`));
    }
    return parseNativeResponse(JSON.parse(output));
  }

  async cancel(jobId: string): Promise<PraxisJobState> {
    const state = await this.state(jobId);
    if (praetorJobFinished(state.status)) return state;
    await this.store.putCancel(jobId, { requestedAt: new Date().toISOString() });
    const channel = await this.ensureChannel();
    channel.publish(this.cancelExchange, "", Buffer.from(JSON.stringify({ jobId })), { contentType: "application/json" });
    if (state.status === "QUEUED") {
      await this.store.putDone(jobId, {
        status: "CANCELLED",
        completedAt: new Date().toISOString(),
        worker: null,
        error: null,
      });
    }
    return this.state(jobId);
  }

  async run(operation: PraetorJobOperation, request: object, deadline: number | undefined, signal: AbortSignal): Promise<NativeResponse> {
    const timeoutMs = deadline === undefined ? undefined : Math.max(1, Math.min(praetorJobTimeout(), deadline - Date.now()));
    const submitted = await this.submit({ operation, request, ...(timeoutMs === undefined ? {} : { timeoutMs }) });
    let pause = POLL_FIRST_MS;
    for (;;) {
      const state = await this.state(submitted.jobId);
      if (praetorJobFinished(state.status)) return this.result(submitted.jobId);
      if (signal.aborted) {
        await this.cancel(submitted.jobId);
        return errorResponse(failure("PRAXIS_CANCELLED", "The PRAXIS request was cancelled by its client."));
      }
      if (deadline !== undefined && Date.now() >= deadline) {
        await this.cancel(submitted.jobId);
        return errorResponse(failure("PRAXIS_TIMEOUT", "The PRAXIS request deadline passed before a worker finished it.", { jobId: submitted.jobId }));
      }
      if (state.status === "QUEUED" && state.workers === 0) {
        this.logger.warn(`PRAXIS job ${submitted.jobId} waits with no PRAETOR worker connected`);
      }
      await delay(pause, signal);
      pause = Math.min(POLL_LONGEST_MS, pause * 2);
    }
  }
}

export { PraxisJobsService };
export type { PraxisJobRequest };
