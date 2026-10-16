import { Test, TestingModule } from '@nestjs/testing';
import { QueueConfigFactory } from './queue-config.factory';
import { ConfigService } from '@nestjs/config';
import { EnvVarKeys } from '../../config/env_vars.config';
describe('QueueConfigFactory', () => {
    let factory: QueueConfigFactory;
    const configured = new Map<string, string>();
    const mockConfigService = {
        get: vi.fn((key: string) => configured.get(key)),
        getOrThrow: vi.fn((key: string) => {
            if (key.includes('DURABLE'))
                return true;
            if (key.includes('TTL') ||
                key.includes('LENGTH') ||
                key.includes('PREFETCH'))
                return 100;
            return key;
        }),
    };
    beforeEach(async () => {
        vi.clearAllMocks();
        configured.clear();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QueueConfigFactory,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();
        factory = module.get<QueueConfigFactory>(QueueConfigFactory);
    });
    it('should be defined', () => {
        expect(factory).toBeDefined();
    });
    describe('createQuantJobQueueConfig', () => {
        it('should return correct config', () => {
            const config = factory.createQuantJobQueueConfig();
            expect(config).toBeDefined();
            expect(config.name).toContain('QUANT_JOB_QUEUE');
            expect(config.durable).toBe(true);
            expect(config.messageTtl).toBe(100);
            expect(config.deadLetter).toBeDefined();
        });
    });
    describe('createPraxisJobQueueConfig', () => {
        it('should use the PRAXIS job queue defaults when nothing is configured', () => {
            expect(factory.createPraxisJobQueueConfig()).toEqual({
                name: 'praxis_jobs',
                exchange: {
                    name: 'praxis_jobs_exchange',
                    type: 'direct',
                    durable: true,
                    bindingKey: 'praxis_jobs_key',
                    routingKey: 'praxis_jobs_key',
                },
                durable: true,
                messageTtl: 172800000,
                maxLength: 100000,
                prefetch: 1,
                deadLetter: {
                    name: 'praxis_jobs_dead_queue',
                    exchange: {
                        name: 'global_exchange',
                        type: 'direct',
                        durable: true,
                        bindingKey: 'praxis_jobs_dead_queue_key',
                        routingKey: 'praxis_jobs_dead_queue_key',
                    },
                    durable: true,
                },
            });
        });
        it('should take configured values and keep the default for a count that is not a positive integer', () => {
            configured.set(EnvVarKeys.PRAXIS_JOB_QUEUE, 'jobs');
            configured.set(EnvVarKeys.PRAXIS_JOB_MSG_TTL, '5000');
            configured.set(EnvVarKeys.PRAXIS_JOB_QUEUE_MAXLENGTH, '0');
            const config = factory.createPraxisJobQueueConfig();
            expect(config.name).toBe('jobs');
            expect(config.messageTtl).toBe(5000);
            expect(config.maxLength).toBe(100000);
        });
    });
    describe('praxisCancelExchange', () => {
        it('should default to the PRAXIS cancel exchange', () => {
            expect(factory.praxisCancelExchange()).toBe('praxis_job_cancel');
        });
    });
    describe('createExecuteTaskQueueConfig', () => {
        it('should return correct config', () => {
            const config = factory.createExecuteTaskQueueConfig();
            expect(config.name).toContain('EXEC_TASK_QUEUE');
            expect(config.durable).toBe(true);
            expect(config.prefetch).toBe(100);
            expect(config.deadLetter).toBeDefined();
        });
    });
});
