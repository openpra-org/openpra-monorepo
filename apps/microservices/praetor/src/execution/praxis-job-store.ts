import { Injectable } from "@nestjs/common";
import type { PraetorJobOperation, PraetorJobStatus } from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import type { NativeStructuredError } from "praxis-node/protocol";
import { MinioService } from "../shared";

interface PraxisJobInput {
  operation: PraetorJobOperation;
  request: object;
  timeoutMs: number;
}

interface PraxisJobSubmissionRecord {
  jobId: string;
  operation: PraetorJobOperation;
  submittedAt: string;
  timeoutMs: number;
}

interface PraxisJobRunningRecord {
  worker: string;
  startedAt: string;
  heartbeatAt: string;
  attempts: number;
}

interface PraxisJobDoneRecord {
  status: Extract<PraetorJobStatus, "SUCCEEDED" | "FAILED" | "CANCELLED">;
  completedAt: string;
  worker: string | null;
  error: NativeStructuredError | null;
}

interface PraxisJobCancelRecord {
  requestedAt: string;
}

function parsed<T>(text: string | undefined): T | undefined {
  return text === undefined ? undefined : (JSON.parse(text) as T);
}

@Injectable()
class PraxisJobStore {
  constructor(private readonly minio: MinioService) {}

  async putInput(jobId: string, input: PraxisJobInput): Promise<void> {
    const text = stringifyJson(input);
    if (text === undefined) throw new Error(`PRAXIS job ${jobId} has no request to store.`);
    await this.minio.putText("input", `praxis-input-${jobId}.json`, text);
  }

  async input(jobId: string): Promise<PraxisJobInput | undefined> {
    return parsed<PraxisJobInput>(await this.minio.getText("input", `praxis-input-${jobId}.json`));
  }

  async putSubmission(record: PraxisJobSubmissionRecord): Promise<void> {
    await this.minio.putText("jobs", `praxis-job-${record.jobId}.json`, JSON.stringify(record));
  }

  async submission(jobId: string): Promise<PraxisJobSubmissionRecord | undefined> {
    return parsed<PraxisJobSubmissionRecord>(await this.minio.getText("jobs", `praxis-job-${jobId}.json`));
  }

  async putRunning(jobId: string, record: PraxisJobRunningRecord): Promise<void> {
    await this.minio.putText("jobs", `praxis-job-${jobId}.running.json`, JSON.stringify(record));
  }

  async running(jobId: string): Promise<PraxisJobRunningRecord | undefined> {
    return parsed<PraxisJobRunningRecord>(await this.minio.getText("jobs", `praxis-job-${jobId}.running.json`));
  }

  async putDone(jobId: string, record: PraxisJobDoneRecord): Promise<void> {
    await this.minio.putText("jobs", `praxis-job-${jobId}.done.json`, JSON.stringify(record));
  }

  async done(jobId: string): Promise<PraxisJobDoneRecord | undefined> {
    return parsed<PraxisJobDoneRecord>(await this.minio.getText("jobs", `praxis-job-${jobId}.done.json`));
  }

  async putCancel(jobId: string, record: PraxisJobCancelRecord): Promise<void> {
    await this.minio.putText("jobs", `praxis-job-${jobId}.cancel.json`, JSON.stringify(record));
  }

  async cancel(jobId: string): Promise<PraxisJobCancelRecord | undefined> {
    return parsed<PraxisJobCancelRecord>(await this.minio.getText("jobs", `praxis-job-${jobId}.cancel.json`));
  }

  async putOutput(jobId: string, responseJson: string): Promise<void> {
    await this.minio.putText("output", `praxis-output-${jobId}.json`, responseJson);
  }

  async output(jobId: string): Promise<string | undefined> {
    return this.minio.getText("output", `praxis-output-${jobId}.json`);
  }
}

export { PraxisJobStore };
export type { PraxisJobCancelRecord, PraxisJobDoneRecord, PraxisJobInput, PraxisJobRunningRecord, PraxisJobSubmissionRecord };
