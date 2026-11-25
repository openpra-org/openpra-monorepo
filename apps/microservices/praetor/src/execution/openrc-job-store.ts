import { Injectable } from "@nestjs/common";
import type { PraetorJobOperation, PraetorJobStatus } from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import type { NativeStructuredError } from "openrc-node/protocol";
import { MinioService } from "../shared";

interface OpenRcJobInput {
  operation: PraetorJobOperation;
  request: object;
  timeoutMs: number;
}

interface OpenRcJobSubmissionRecord {
  jobId: string;
  operation: PraetorJobOperation;
  submittedAt: string;
  timeoutMs: number;
}

interface OpenRcJobRunningRecord {
  worker: string;
  startedAt: string;
  heartbeatAt: string;
  attempts: number;
}

interface OpenRcJobDoneRecord {
  status: Extract<PraetorJobStatus, "SUCCEEDED" | "FAILED" | "CANCELLED">;
  completedAt: string;
  worker: string | null;
  error: NativeStructuredError | null;
}

interface OpenRcJobCancelRecord {
  requestedAt: string;
}

function parsed<T>(text: string | undefined): T | undefined {
  return text === undefined ? undefined : (JSON.parse(text) as T);
}

@Injectable()
class OpenRcJobStore {
  constructor(private readonly minio: MinioService) {}

  async putInput(jobId: string, input: OpenRcJobInput): Promise<void> {
    const text = stringifyJson(input);
    if (text === undefined) throw new Error(`OpenRC job ${jobId} has no request to store.`);
    await this.minio.putText("input", `openrc-input-${jobId}.json`, text);
  }

  async input(jobId: string): Promise<OpenRcJobInput | undefined> {
    return parsed<OpenRcJobInput>(await this.minio.getText("input", `openrc-input-${jobId}.json`));
  }

  async putSubmission(record: OpenRcJobSubmissionRecord): Promise<void> {
    await this.minio.putText("jobs", `openrc-job-${record.jobId}.json`, JSON.stringify(record));
  }

  async submission(jobId: string): Promise<OpenRcJobSubmissionRecord | undefined> {
    return parsed<OpenRcJobSubmissionRecord>(await this.minio.getText("jobs", `openrc-job-${jobId}.json`));
  }

  async putRunning(jobId: string, record: OpenRcJobRunningRecord): Promise<void> {
    await this.minio.putText("jobs", `openrc-job-${jobId}.running.json`, JSON.stringify(record));
  }

  async running(jobId: string): Promise<OpenRcJobRunningRecord | undefined> {
    return parsed<OpenRcJobRunningRecord>(await this.minio.getText("jobs", `openrc-job-${jobId}.running.json`));
  }

  async putDone(jobId: string, record: OpenRcJobDoneRecord): Promise<void> {
    await this.minio.putText("jobs", `openrc-job-${jobId}.done.json`, JSON.stringify(record));
  }

  async done(jobId: string): Promise<OpenRcJobDoneRecord | undefined> {
    return parsed<OpenRcJobDoneRecord>(await this.minio.getText("jobs", `openrc-job-${jobId}.done.json`));
  }

  async putCancel(jobId: string, record: OpenRcJobCancelRecord): Promise<void> {
    await this.minio.putText("jobs", `openrc-job-${jobId}.cancel.json`, JSON.stringify(record));
  }

  async cancel(jobId: string): Promise<OpenRcJobCancelRecord | undefined> {
    return parsed<OpenRcJobCancelRecord>(await this.minio.getText("jobs", `openrc-job-${jobId}.cancel.json`));
  }

  async putOutput(jobId: string, responseJson: string): Promise<void> {
    await this.minio.putText("output", `openrc-output-${jobId}.json`, responseJson);
  }

  async output(jobId: string): Promise<string | undefined> {
    return this.minio.getText("output", `openrc-output-${jobId}.json`);
  }
}

export { OpenRcJobStore };
export type { OpenRcJobCancelRecord, OpenRcJobDoneRecord, OpenRcJobInput, OpenRcJobRunningRecord, OpenRcJobSubmissionRecord };
