import { resolve } from 'node:path';
import { threadId } from 'node:worker_threads';

import { runPraxisWithWorker } from './praxis-worker-runner';

const addonPath = resolve(__dirname, '../../../../../solvers/praxis-node/index.js');
const workerPath = resolve(__dirname, 'praxis.worker.js');
const requestJson = JSON.stringify({
    schemaVersion: '1.0.0',
    request: {
        schemaVersion: '1.0.0',
        methodType: 'HYBRID_CAUSAL_LOGIC',
    },
    modelSnapshots: [{ methodType: 'HYBRID_CAUSAL_LOGIC' }],
});

describe('PRAXIS native worker integration', () => {
    it.each([
        ['validate', 'result', 'TRANSPORT'],
        ['execute', 'error', 'SOLVER_ERROR'],
    ] as const)('runs %s through the native addon outside the calling thread', async (operation, field, value) => {
        const response = await runPraxisWithWorker(
            { operation, requestJson },
            { addonPath, workerPath },
        );
        const result = JSON.parse(response.resultJson) as Record<string, Record<string, unknown>>;

        expect(response.workerThreadId).toBeGreaterThan(0);
        expect(response.workerThreadId).not.toBe(threadId);
        expect(field === 'result' ? result.result.scope : result.error.kind).toBe(value);
    });
});
