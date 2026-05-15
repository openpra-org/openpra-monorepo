export interface ExecutionResult {
    _id?: string;
    exit_code: number;
    stderr: string;
    stdout: string;
}
