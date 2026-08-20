export type ExecuteSolver =
    | 'scram'
    | 'praxis'
    | 'xfta'
    | 'ftrex'
    | 'zebra'
    | 'saphsolve';

export interface ExecuteRequest {
    argv: string;
    input: string;
}

export interface ExecuteJob extends ExecuteRequest {
    _id: string;
    solver: ExecuteSolver;
}
