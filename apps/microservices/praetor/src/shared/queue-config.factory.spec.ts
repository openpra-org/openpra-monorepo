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
    describe('createOpenRcJobQueueConfig', () => {
        it('should use the OpenRC job queue defaults when nothing is configured', () => {
            expect(factory.createOpenRcJobQueueConfig()).toEqual({
                name: 'openrc_jobs',
                exchange: {
                    name: 'openrc_jobs_exchange',
                    type: 'direct',
                    durable: true,
                    bindingKey: 'openrc_jobs_key',
                    routingKey: 'openrc_jobs_key',
                },
                durable: true,
                messageTtl: 172800000,
                maxLength: 100000,
                prefetch: 1,
                deadLetter: {
                    name: 'openrc_jobs_dead_queue',
                    exchange: {
                        name: 'global_exchange',
                        type: 'direct',
                        durable: true,
                        bindingKey: 'openrc_jobs_dead_queue_key',
                        routingKey: 'openrc_jobs_dead_queue_key',
                    },
                    durable: true,
                },
            });
        });
        it('should take configured values and keep the default for a count that is not a positive integer', () => {
            configured.set(EnvVarKeys.OPENRC_JOB_QUEUE, 'consequence_jobs');
            configured.set(EnvVarKeys.OPENRC_JOB_EXCHANGE_ID, 'consequence_exchange');
            configured.set(EnvVarKeys.OPENRC_JOB_ROUTING_KEY, 'consequence_key');
            configured.set(EnvVarKeys.OPENRC_JOB_DEAD_LETTER_QUEUE, 'consequence_dead');
            configured.set(EnvVarKeys.OPENRC_JOB_DEAD_LETTER_EXCHANGE_ID, 'dead_exchange');
            configured.set(EnvVarKeys.OPENRC_JOB_DEAD_LETTER_ROUTING_KEY, 'dead_key');
            configured.set(EnvVarKeys.OPENRC_JOB_MSG_TTL, '5000');
            configured.set(EnvVarKeys.OPENRC_JOB_QUEUE_MAXLENGTH, '0');
            const config = factory.createOpenRcJobQueueConfig();
            expect(config.name).toBe('consequence_jobs');
            expect(config.exchange).toMatchObject({ name: 'consequence_exchange', bindingKey: 'consequence_key', routingKey: 'consequence_key' });
            expect(config.deadLetter).toMatchObject({
                name: 'consequence_dead',
                exchange: { name: 'dead_exchange', bindingKey: 'dead_key', routingKey: 'dead_key' },
            });
            expect(config.messageTtl).toBe(5000);
            expect(config.maxLength).toBe(100000);
        });
        it('should fall back to the default for a blank name', () => {
            configured.set(EnvVarKeys.OPENRC_JOB_QUEUE, '   ');
            expect(factory.createOpenRcJobQueueConfig().name).toBe('openrc_jobs');
        });
        it('should not share a queue, an exchange or a routing key with the PRAXIS jobs', () => {
            const openRc = factory.createOpenRcJobQueueConfig();
            const praxis = factory.createPraxisJobQueueConfig();
            expect(openRc.name).not.toBe(praxis.name);
            expect(openRc.exchange.name).not.toBe(praxis.exchange.name);
            expect(openRc.exchange.routingKey).not.toBe(praxis.exchange.routingKey);
            expect(openRc.deadLetter.name).not.toBe(praxis.deadLetter.name);
            expect(openRc.deadLetter.exchange.routingKey).not.toBe(praxis.deadLetter.exchange.routingKey);
            expect(factory.openRcCancelExchange()).not.toBe(factory.praxisCancelExchange());
        });
        it('should read the OpenRC keys, never the PRAXIS ones', () => {
            configured.set(EnvVarKeys.PRAXIS_JOB_QUEUE, 'praxis_configured');
            configured.set(EnvVarKeys.PRAXIS_CANCEL_EXCHANGE_ID, 'praxis_cancel_configured');
            expect(factory.createOpenRcJobQueueConfig().name).toBe('openrc_jobs');
            expect(factory.openRcCancelExchange()).toBe('openrc_job_cancel');
        });
    });
    describe('openRcCancelExchange', () => {
        it('should default to the OpenRC cancel exchange', () => {
            expect(factory.openRcCancelExchange()).toBe('openrc_job_cancel');
        });
        it('should take the configured exchange', () => {
            configured.set(EnvVarKeys.OPENRC_CANCEL_EXCHANGE_ID, 'consequence_cancel');
            expect(factory.openRcCancelExchange()).toBe('consequence_cancel');
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
