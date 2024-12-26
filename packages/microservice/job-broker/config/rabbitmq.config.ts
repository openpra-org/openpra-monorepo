/**
 * Enum for RabbitMQ configuration keys.
 */
export enum RabbitMQConfigKeys {
  RABBITMQ_URL = "RABBITMQ_URL",
  EXECUTABLE_TASK_QUEUE_NAME = "initial_executable_queue",
  EXECUTABLE_STORAGE_QUEUE_NAME = "executable_result_storage_queue",
  QUANT_JOB_QUEUE_NAME = "initial_quantification_queue",
  QUANT_STORAGE_QUEUE_NAME = "quantification_result_storage_queue",
  DEAD_LETTER_QUEUE_NAME = "dead_letter_queue",
  DEAD_LETTER_EXCHANGE_NAME = "dead_letter_exchange",
}

/**
 * Interface for RabbitMQ environment variables.
 */
export interface RabbitMQEnvVars {
  [RabbitMQConfigKeys.RABBITMQ_URL]: string;
  [RabbitMQConfigKeys.DEAD_LETTER_EXCHANGE_NAME]: string;
  [RabbitMQConfigKeys.DEAD_LETTER_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.EXECUTABLE_STORAGE_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.EXECUTABLE_TASK_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE_NAME]: string;
  [RabbitMQConfigKeys.QUANT_STORAGE_QUEUE_NAME]: string;
}

export const getRabbitMQConfig = () => ({
  [RabbitMQConfigKeys.RABBITMQ_URL]: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  [RabbitMQConfigKeys.DEAD_LETTER_EXCHANGE_NAME]: process.env.DEAD_LETTER_EXCHANGE_NAME || 'dead_letter_exchange',
  [RabbitMQConfigKeys.DEAD_LETTER_QUEUE_NAME]: process.env.DEAD_LETTER_QUEUE_NAME || 'dead_letter_queue',
  [RabbitMQConfigKeys.EXECUTABLE_STORAGE_QUEUE_NAME]: process.env.EXECUTABLE_STORAGE_QUEUE_NAME || 'executable_result_storage_queue',
  [RabbitMQConfigKeys.EXECUTABLE_TASK_QUEUE_NAME]: process.env.EXECUTABLE_TASK_QUEUE_NAME || 'initial_executable_queue',
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE_NAME]: process.env.QUANT_JOB_QUEUE_NAME || 'initial_quantification_queue',
  [RabbitMQConfigKeys.QUANT_STORAGE_QUEUE_NAME]: process.env.QUANT_STORAGE_QUEUE_NAME || 'quantification_result_storage_queue',
});
