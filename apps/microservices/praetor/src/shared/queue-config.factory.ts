import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVarKeys } from '../../config/env_vars.config';
import { QueueConfig } from './queue-config.interfaces';
@Injectable()
export class QueueConfigFactory {
    constructor(private readonly configSvc: ConfigService) { }
    public createQuantJobQueueConfig(): QueueConfig {
        return {
            name: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_QUEUE),
            exchange: {
                name: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_EXCHANGE_ID),
                type: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_EXCHANGE_TYPE),
                durable: this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_EXCHANGE_DURABLE),
                bindingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_BINDING_KEY),
                routingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_ROUTING_KEY),
            },
            durable: Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_QUEUE_DURABLE)),
            messageTtl: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_MSG_TTL)),
            maxLength: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_QUEUE_MAXLENGTH)),
            prefetch: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_MSG_PREFETCH)),
            deadLetter: {
                name: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE),
                exchange: {
                    name: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_ID),
                    type: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_TYPE),
                    durable: this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_DURABLE),
                    bindingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_BINDING_KEY),
                    routingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_ROUTING_KEY),
                },
                durable: Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE)),
            },
        };
    }
    private text(key: string, fallback: string): string {
        const value = this.configSvc.get<string>(key);
        return value === undefined || String(value).trim().length === 0 ? fallback : String(value);
    }

    private count(key: string, fallback: number): number {
        const value = Number(this.configSvc.get<string>(key));
        return Number.isSafeInteger(value) && value > 0 ? value : fallback;
    }

    public createPraxisJobQueueConfig(): QueueConfig {
        const routingKey = this.text(EnvVarKeys.PRAXIS_JOB_ROUTING_KEY, 'praxis_jobs_key');
        const deadRoutingKey = this.text(EnvVarKeys.PRAXIS_JOB_DEAD_LETTER_ROUTING_KEY, 'praxis_jobs_dead_queue_key');
        return {
            name: this.text(EnvVarKeys.PRAXIS_JOB_QUEUE, 'praxis_jobs'),
            exchange: {
                name: this.text(EnvVarKeys.PRAXIS_JOB_EXCHANGE_ID, 'praxis_jobs_exchange'),
                type: 'direct',
                durable: true,
                bindingKey: routingKey,
                routingKey,
            },
            durable: true,
            messageTtl: this.count(EnvVarKeys.PRAXIS_JOB_MSG_TTL, 172800000),
            maxLength: this.count(EnvVarKeys.PRAXIS_JOB_QUEUE_MAXLENGTH, 100000),
            prefetch: 1,
            deadLetter: {
                name: this.text(EnvVarKeys.PRAXIS_JOB_DEAD_LETTER_QUEUE, 'praxis_jobs_dead_queue'),
                exchange: {
                    name: this.text(EnvVarKeys.PRAXIS_JOB_DEAD_LETTER_EXCHANGE_ID, 'global_exchange'),
                    type: 'direct',
                    durable: true,
                    bindingKey: deadRoutingKey,
                    routingKey: deadRoutingKey,
                },
                durable: true,
            },
        };
    }

    public praxisCancelExchange(): string {
        return this.text(EnvVarKeys.PRAXIS_CANCEL_EXCHANGE_ID, 'praxis_job_cancel');
    }

    public createExecuteTaskQueueConfig(): QueueConfig {
        return {
            name: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_QUEUE),
            exchange: {
                name: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_EXCHANGE_ID),
                type: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_EXCHANGE_TYPE),
                durable: this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_EXCHANGE_DURABLE),
                bindingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_BINDING_KEY),
                routingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_ROUTING_KEY),
            },
            durable: Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_QUEUE_DURABLE)),
            messageTtl: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_MSG_TTL)),
            maxLength: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_QUEUE_MAXLENGTH)),
            prefetch: Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_MSG_PREFETCH)),
            deadLetter: {
                name: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE),
                exchange: {
                    name: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE_ID),
                    type: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE_TYPE),
                    durable: this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE_DURABLE),
                    bindingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_BINDING_KEY),
                    routingKey: this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_ROUTING_KEY),
                },
                durable: Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE)),
            },
        };
    }
}
