/**
 * Configuration for a queue
 */
export interface QueueConfig {
  /** Name of the queue */
  name: string;
  /** Whether the queue should survive broker restarts */
  durable: boolean;
  /** Time-to-live for messages in the queue (milliseconds) */
  messageTtl: number;
  /** Maximum number of messages that can be in the queue */
  maxLength: number;
  /** Number of messages to prefetch */
  prefetch?: number;
  /** Dead letter exchange configuration */
  deadLetter: DeadLetterConfig;
}

/**
 * Configuration for a dead letter exchange
 */
export interface DeadLetterConfig {
  /** Name of the dead letter queue */
  name: string;
  /** Name of the dead letter exchange */
  exchange: string;
  /** Whether the dead letter queue should survive broker restarts */
  durable: boolean;
}
