import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

type PraxisOperation = 'validate' | 'execute';

interface PraxisWorkerTask {
    operation: PraxisOperation;
    requestJson: string;
}

interface PraxisWorkerResult {
    resultJson: string;
    workerThreadId: number;
}

interface PraxisWorkerRunnerOptions {
    addonPath?: string;
    workerPath?: string;
}

interface PraxisWorkerMessage {
    resultJson?: string;
    error?: string;
    stack?: string;
    workerThreadId?: number;
}

function findWorkerPath(): string {
    const candidates = [
        join(__dirname, 'praxis.worker.js'),
        join(__dirname, 'workers', 'praxis.worker.js'),
        join(__dirname, 'execution', 'workers', 'praxis.worker.js'),
        join(process.cwd(), 'execution', 'workers', 'praxis.worker.js'),
    ];
    const workerPath = candidates.find((candidate) => existsSync(candidate));
    if (workerPath === undefined) {
        throw new Error('Unable to locate praxis.worker.js for native solver execution.');
    }
    return workerPath;
}

function findAddonPath(): string {
    return require.resolve('praxis-node');
}

function runPraxisWithWorker(
    task: PraxisWorkerTask,
    options: PraxisWorkerRunnerOptions = {},
): Promise<PraxisWorkerResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(options.workerPath ?? findWorkerPath(), {
            workerData: {
                ...task,
                addonPath: options.addonPath ?? findAddonPath(),
            },
        });
        let settled = false;

        const finalize = (): void => {
            settled = true;
            worker.removeAllListeners();
        };
        const terminateSafely = async (): Promise<void> => {
            try {
                await worker.terminate();
            }
            catch {
                // The worker may already have exited after posting its result.
            }
        };

        worker.once('message', async (message: PraxisWorkerMessage) => {
            if (settled) return;
            finalize();
            await terminateSafely();

            if (message.error !== undefined) {
                const error = new Error(message.error);
                if (message.stack !== undefined) error.stack = message.stack;
                reject(error);
                return;
            }
            if (
                typeof message.resultJson !== 'string' ||
                typeof message.workerThreadId !== 'number' ||
                message.workerThreadId <= 0
            ) {
                reject(new Error('PRAXIS worker returned an invalid result message.'));
                return;
            }
            resolve({
                resultJson: message.resultJson,
                workerThreadId: message.workerThreadId,
            });
        });
        worker.once('error', async (error: unknown) => {
            if (settled) return;
            finalize();
            await terminateSafely();
            reject(error);
        });
        worker.once('exit', (code: number) => {
            if (settled) return;
            finalize();
            reject(
                new Error(
                    code === 0
                        ? 'PRAXIS worker exited before returning a result.'
                        : `PRAXIS worker exited with code ${code}`,
                ),
            );
        });
    });
}

export { runPraxisWithWorker };
export type {
    PraxisOperation,
    PraxisWorkerTask,
    PraxisWorkerResult,
    PraxisWorkerRunnerOptions,
};
