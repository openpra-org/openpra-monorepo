import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExecuteSolver } from '../../common/types/execute-request';
import { getSolverDescriptor, resolveSolverBinary } from '../solvers.registry';

export interface SolverProcessOptions {
    solver: ExecuteSolver;
    argv: string;
    input: string;
    timeoutMs: number;
}

export interface SolverProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    output: string | null;
    outputName: string | null;
    durationMs: number;
    timedOut: boolean;
}

interface SpawnOutcome {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
}

function splitArgv(argv: string): string[] {
    return argv
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

function spawnSolver(binary: string, args: string[], cwd: string, timeoutMs: number): Promise<SpawnOutcome> {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const child = spawn(binary, args, { cwd, shell: false });
        const stdoutChunks: Uint8Array[] = [];
        const stderrChunks: Uint8Array[] = [];
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);
        child.stdout.on('data', (chunk: Uint8Array) => {
            stdoutChunks.push(chunk);
        });
        child.stderr.on('data', (chunk: Uint8Array) => {
            stderrChunks.push(chunk);
        });
        child.on('error', (error: Error) => {
            clearTimeout(timer);
            reject(new Error(`Failed to start solver binary '${binary}': ${error.message}`));
        });
        child.on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({
                exitCode: code ?? -1,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
                durationMs: Date.now() - startedAt,
                timedOut,
            });
        });
    });
}

async function readOutputFile(path: string): Promise<string | null> {
    try {
        await access(path);
    }
    catch {
        return null;
    }
    const buffer = await readFile(path);
    return buffer.toString('base64');
}

export async function runSolverProcess(options: SolverProcessOptions): Promise<SolverProcessResult> {
    const descriptor = getSolverDescriptor(options.solver);
    if (!descriptor.implemented) {
        throw new Error(`Solver '${options.solver}' execute endpoint is not implemented yet.`);
    }
    const workDir = await mkdtemp(join(tmpdir(), 'praetor-exec-'));
    const inputName = `in-${randomUUID()}${descriptor.inputExtension}`;
    const outputName = `out-${randomUUID()}${descriptor.outputExtension}`;
    try {
        const decoded = Buffer.from(options.input, 'base64');
        const inputBytes = new Uint8Array(decoded.length);
        inputBytes.set(decoded);
        await writeFile(join(workDir, inputName), inputBytes);
        const args = descriptor.buildArgs({
            settings: splitArgv(options.argv),
            inputFile: inputName,
            outputFile: outputName,
        });
        const binary = resolveSolverBinary(descriptor);
        const outcome = await spawnSolver(binary, args, workDir, options.timeoutMs);
        const output = await readOutputFile(join(workDir, outputName));
        return {
            exitCode: outcome.exitCode,
            stdout: outcome.stdout,
            stderr: outcome.stderr,
            output,
            outputName: output === null ? null : outputName,
            durationMs: outcome.durationMs,
            timedOut: outcome.timedOut,
        };
    }
    finally {
        await rm(workDir, { recursive: true, force: true });
    }
}
