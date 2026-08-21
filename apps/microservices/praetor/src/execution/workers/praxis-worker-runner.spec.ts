import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';

import { runPraxisWithWorker } from './praxis-worker-runner';

vi.mock('node:worker_threads', () => ({ Worker: vi.fn() }));

describe('runPraxisWithWorker', () => {
    let worker: EventEmitter & {
        removeAllListeners: ReturnType<typeof vi.fn>;
        terminate: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        worker = Object.assign(new EventEmitter(), {
            removeAllListeners: vi.fn(),
            terminate: vi.fn().mockResolvedValue(undefined),
        });
        vi.mocked(Worker).mockImplementation(function () {
            return worker as never;
        });
    });

    it.each(['validate', 'execute'] as const)('runs %s in a worker and resolves its JSON', async (operation) => {
        const promise = runPraxisWithWorker(
            { operation, requestJson: '{"schemaVersion":"1.0.0"}' },
            { addonPath: 'C:/native/praxis-node/index.js', workerPath: 'C:/workers/praxis.worker.js' },
        );

        expect(Worker).toHaveBeenCalledWith('C:/workers/praxis.worker.js', {
            workerData: {
                operation,
                requestJson: '{"schemaVersion":"1.0.0"}',
                addonPath: 'C:/native/praxis-node/index.js',
            },
        });
        worker.emit('message', { resultJson: '{"ok":true}', workerThreadId: 7 });

        await expect(promise).resolves.toEqual({
            resultJson: '{"ok":true}',
            workerThreadId: 7,
        });
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it('rejects errors reported inside the worker', async () => {
        const promise = runPraxisWithWorker(
            { operation: 'execute', requestJson: '{}' },
            { addonPath: 'addon', workerPath: 'worker' },
        );
        worker.emit('message', { error: 'native failure', stack: 'native stack', workerThreadId: 3 });

        await expect(promise).rejects.toMatchObject({ message: 'native failure', stack: 'native stack' });
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it.each([
        {},
        { resultJson: 42, workerThreadId: 2 },
        { resultJson: '{}', workerThreadId: 0 },
    ])('rejects an invalid worker message %#', async (message) => {
        const promise = runPraxisWithWorker(
            { operation: 'validate', requestJson: '{}' },
            { addonPath: 'addon', workerPath: 'worker' },
        );
        worker.emit('message', message);

        await expect(promise).rejects.toThrow('PRAXIS worker returned an invalid result message.');
    });

    it('rejects a worker system error', async () => {
        const promise = runPraxisWithWorker(
            { operation: 'execute', requestJson: '{}' },
            { addonPath: 'addon', workerPath: 'worker' },
        );
        worker.emit('error', new Error('worker system failure'));

        await expect(promise).rejects.toThrow('worker system failure');
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it.each([
        [0, 'PRAXIS worker exited before returning a result.'],
        [2, 'PRAXIS worker exited with code 2'],
    ])('rejects exit code %i before a result', async (code, message) => {
        const promise = runPraxisWithWorker(
            { operation: 'execute', requestJson: '{}' },
            { addonPath: 'addon', workerPath: 'worker' },
        );
        worker.emit('exit', code);

        await expect(promise).rejects.toThrow(message);
    });
});
