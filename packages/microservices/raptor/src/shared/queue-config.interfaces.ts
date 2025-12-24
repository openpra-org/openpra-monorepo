/**
 * Configuration for a queue
 */
export interface QueueConfig {
  /** Name of the queue */
  name: string;
  /** Properties of the exchange connected with the queue */
  exchange: ExchangeConfig;
  /** Whether the queue should survive broker restarts */
  durable: boolean;
  /** Time-to-live for messages in the queue (milliseconds) */
  messageTtl: number;
  /** Maximum number of messages that can be in the queue */
  maxLength: number;
  /** Number of messages to prefetch */
  prefetch?: number;
  /** Dead letter queue configuration */
  deadLetter: DeadLetterConfig;
}

export interface ExchangeConfig {
  /** Name of the exchange */
  name: string;
  /** Type of exchange (e.g.: direct, fanout etc.) */
  type: string;
  /** Whether the exchange should survive broker restarts */
  durable: boolean;
  /** The key that binds the exchange with the queue */
  bindingKey: string;
  /** The key that binds the service with the exchange */
  routingKey: string;
}

/**
 * Configuration for a dead letter queue
 */
export interface DeadLetterConfig {
  /** Name of the dead letter queue */
  name: string;
  /** Properties of the exchange connected with the dead letter queue */
  exchange: ExchangeConfig;
  /** Whether the dead letter queue should survive broker restarts */
  durable: boolean;
}
