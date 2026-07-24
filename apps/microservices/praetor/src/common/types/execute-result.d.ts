import { ExecutionResult } from './execution-result';
import { ExecuteSolver } from './execute-request';

export interface ExecuteResult extends ExecutionResult {
    solver: ExecuteSolver;
    output: string | null;
    outputName: string | null;
    durationMs: number;
    timedOut: boolean;
}
