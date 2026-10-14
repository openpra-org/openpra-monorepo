export type PraetorJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type PraetorJobOperation = "execute" | "validate";
export interface PraetorJobError {
  kind: string;
  code: string;
  message: string;
  details: object;
}
export interface PraetorJobState<E extends PraetorJobError = PraetorJobError> {
  jobId: string;
  operation: PraetorJobOperation;
  status: PraetorJobStatus;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  worker: string | null;
  attempts: number;
  queuedJobs: number | null;
  workers: number | null;
  error: E | null;
}
export function parsePraetorJobState(value: object): PraetorJobState;
export function praetorJobFinished(status: PraetorJobStatus): boolean;
export function praetorJobTimeout(value?: string): number;
export function isPraetorJobId(value: string): boolean;
export const PRAETOR_JOB_OPERATIONS: readonly PraetorJobOperation[];
