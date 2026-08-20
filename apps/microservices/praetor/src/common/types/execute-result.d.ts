import type { ExecutionResult } from '../../../../../../packages/shared-types/src/lib/utils/execution-result';
import { ExecuteSolver } from './execute-request';

export interface ExecuteResult extends ExecutionResult {
    solver: ExecuteSolver;
    output: string | null;
    outputName: string | null;
    durationMs: number;
    timedOut: boolean;
}
