/**
 * Enum for RabbitMQ configuration keys.
 */
export enum RabbitMQConfigKeys {
  EXECUTABLE_TASK_QUEUE_NAME = "EXECUTABLE_TASK_QUEUE_NAME",
  EXECUTABLE_STORAGE_QUEUE_NAME = "EXECUTABLE_STORAGE_QUEUE_NAME",
  QUANT_JOB_QUEUE_NAME = "QUANT_JOB_QUEUE_NAME",
  QUANT_STORAGE_QUEUE_NAME = "QUANT_STORAGE_QUEUE_NAME",
  DEAD_LETTER_QUEUE_NAME = "DEAD_LETTER_QUEUE_NAME",
  DEAD_LETTER_EXCHANGE_NAME = "DEAD_LETTER_EXCHANGE_NAME",
}

/**
 * Interface for RabbitMQ environment variables.
 */
export interface RabbitMQEnvVars {
  [RabbitMQConfigKeys.DEAD_LETTER_EXCHANGE_NAME]: string;
  [RabbitMQConfigKeys.DEAD_LETTER_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.EXECUTABLE_STORAGE_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.EXECUTABLE_TASK_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.QUANT_STORAGE_QUEUE_NAME]: string;
}
