import type { ExecutionResult } from "interfaces-shared-types/execution";
import { ExecuteSolver } from './execute-request';

export interface ExecuteResult extends ExecutionResult {
    solver: ExecuteSolver;
    output: string | null;
    outputName: string | null;
    durationMs: number;
    timedOut: boolean;
}
