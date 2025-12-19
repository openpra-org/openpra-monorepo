import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVarKeys } from '../../config/env_vars.config';
import { QueueConfig } from './queue-config.interfaces';

@Injectable()
export class QueueConfigFactory {
  constructor(private readonly configSvc: ConfigService) {}

  /**
   * Creates a configuration for the quantification job queue
   */
  public createQuantJobQueueConfig(): QueueConfig {
    return {
      name: this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_QUEUE),
      exchange: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.QUANT_JOB_EXCHANGE_ID,
        ),
        type: this.configSvc.getOrThrow<string>(
          EnvVarKeys.QUANT_JOB_EXCHANGE_TYPE,
        ),
        durable: this.configSvc.getOrThrow<boolean>(
          EnvVarKeys.QUANT_JOB_EXCHANGE_DURABLE,
        ),
        bindingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.QUANT_JOB_BINDING_KEY,
        ),
        routingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.QUANT_JOB_ROUTING_KEY,
        ),
      },
      durable: Boolean(
        this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_QUEUE_DURABLE),
      ),
      messageTtl: Number(
        this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_MSG_TTL),
      ),
      maxLength: Number(
        this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_QUEUE_MAXLENGTH),
      ),
      prefetch: Number(
        this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_MSG_PREFETCH),
      ),
      deadLetter: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE,
        ),
        exchange: {
          name: this.configSvc.getOrThrow<string>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_ID,
          ),
          type: this.configSvc.getOrThrow<string>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_TYPE,
          ),
          durable: this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE_DURABLE,
          ),
          bindingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_BINDING_KEY,
          ),
          routingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_ROUTING_KEY,
          ),
        },
        durable: Boolean(
          this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE,
          ),
        ),
      },
    };
  }

  /**
   * Creates a configuration for the distributed sequences job queue
   */
  public createDistributedSequencesJobQueueConfig(): QueueConfig {
    return {
      name: this.configSvc.getOrThrow<string>(
        EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_QUEUE,
      ),
      exchange: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_EXCHANGE_ID,
        ),
        type: this.configSvc.getOrThrow<string>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_EXCHANGE_TYPE,
        ),
        durable: this.configSvc.getOrThrow<boolean>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_EXCHANGE_DURABLE,
        ),
        bindingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_BINDING_KEY,
        ),
        routingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_ROUTING_KEY,
        ),
      },
      durable: Boolean(
        this.configSvc.getOrThrow<boolean>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_QUEUE_DURABLE,
        ),
      ),
      messageTtl: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_MSG_TTL,
        ),
      ),
      maxLength: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_QUEUE_MAXLENGTH,
        ),
      ),
      prefetch: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_MSG_PREFETCH,
        ),
      ),
      deadLetter: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_QUEUE,
        ),
        exchange: {
          name: this.configSvc.getOrThrow<string>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_ID,
          ),
          type: this.configSvc.getOrThrow<string>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_TYPE,
          ),
          durable: this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_DURABLE,
          ),
          bindingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_BINDING_KEY,
          ),
          routingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_ROUTING_KEY,
          ),
        },
        durable: Boolean(
          this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.DISTRIBUTED_SEQUENCES_JOB_DEAD_LETTER_QUEUE_DURABLE,
          ),
        ),
      },
    };
  }

  /**
   * Creates a configuration for the adaptive sequences job queue
   */
  public createAdaptiveSequencesJobQueueConfig(): QueueConfig {
    return {
      name: this.configSvc.getOrThrow<string>(
        EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_QUEUE,
      ),
      exchange: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_EXCHANGE_ID,
        ),
        type: this.configSvc.getOrThrow<string>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_EXCHANGE_TYPE,
        ),
        durable: this.configSvc.getOrThrow<boolean>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_EXCHANGE_DURABLE,
        ),
        bindingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_BINDING_KEY,
        ),
        routingKey: this.configSvc.getOrThrow<string>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_ROUTING_KEY,
        ),
      },
      durable: Boolean(
        this.configSvc.getOrThrow<boolean>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_QUEUE_DURABLE,
        ),
      ),
      messageTtl: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_MSG_TTL,
        ),
      ),
      maxLength: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_QUEUE_MAXLENGTH,
        ),
      ),
      prefetch: Number(
        this.configSvc.getOrThrow<number>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_MSG_PREFETCH,
        ),
      ),
      deadLetter: {
        name: this.configSvc.getOrThrow<string>(
          EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_QUEUE,
        ),
        exchange: {
          name: this.configSvc.getOrThrow<string>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_ID,
          ),
          type: this.configSvc.getOrThrow<string>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_TYPE,
          ),
          durable: this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_EXCHANGE_DURABLE,
          ),
          bindingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_BINDING_KEY,
          ),
          routingKey: this.configSvc.getOrThrow<string>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_ROUTING_KEY,
          ),
        },
        durable: Boolean(
          this.configSvc.getOrThrow<boolean>(
            EnvVarKeys.ADAPTIVE_SEQUENCES_JOB_DEAD_LETTER_QUEUE_DURABLE,
          ),
        ),
      },
    };
  }
}
