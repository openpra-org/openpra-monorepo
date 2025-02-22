/**
 * Enum for RabbitMQ configuration keys.
 */
export enum RabbitMQConfigKeys {
  ENV_RABBITMQ_URL = "RABBITMQ_URL",
  /** Executable Task **/
  // exec task queue
  EXEC_TASK_QUEUE = "MQ_EXEC_TASK_QUEUE_ID",
  EXEC_TASK_QUEUE_DURABLE = "MQ_EXEC_TASK_QUEUE_DURABLE",
  EXEC_TASK_QUEUE_MAXLENGTH = "MQ_EXEC_TASK_QUEUE_MAXLENGTH",
  // exec task message
  EXEC_TASK_MSG_TTL = "MQ_EXEC_TASK_MSG_TTL",
  EXEC_TASK_MSG_PREFETCH = "MQ_EXEC_TASK_MSG_PREFETCH_COUNT",
  // exec task dead letter
  EXEC_TASK_DEAD_LETTER_EXCHANGE = "MQ_EXEC_TASK_DEAD_LETTER_EXCHANGE_ID",
  EXEC_TASK_DEAD_LETTER_QUEUE = "MQ_EXEC_TASK_DEAD_LETTER_QUEUE_ID",
  EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE = "MQ_EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE",

  /** Executable Storage **/
  // exec storage queue
  EXEC_STORAGE_QUEUE = "MQ_EXEC_STORAGE_QUEUE_ID",
  EXEC_STORAGE_QUEUE_DURABLE = "MQ_EXEC_STORAGE_QUEUE_DURABLE",
  EXEC_STORAGE_QUEUE_MAXLENGTH = "MQ_EXEC_STORAGE_QUEUE_MAXLENGTH",
  // exec storage message
  EXEC_STORAGE_MSG_TTL = "MQ_EXEC_STORAGE_MSG_TTL",
  EXEC_STORAGE_MSG_PREFETCH = "MQ_EXEC_STORAGE_MSG_PREFETCH_COUNT",
  // exec storage dead letter (see below)
  EXEC_STORAGE_DEAD_LETTER_EXCHANGE = "MQ_EXEC_STORAGE_DEAD_LETTER_EXCHANGE_ID",
  EXEC_STORAGE_DEAD_LETTER_QUEUE = "MQ_EXEC_STORAGE_DEAD_LETTER_QUEUE_ID",
  EXEC_STORAGE_DEAD_LETTER_QUEUE_DURABLE = "MQ_EXEC_STORAGE_DEAD_LETTER_QUEUE_DURABLE",

  /** Quantification Job **/
  // quant job queue
  QUANT_JOB_QUEUE = "MQ_QUANT_JOB_QUEUE_ID",
  QUANT_JOB_QUEUE_DURABLE = "MQ_QUANT_JOB_QUEUE_DURABLE",
  QUANT_JOB_QUEUE_MAXLENGTH = "MQ_QUANT_JOB_QUEUE_MAXLENGTH",
  // quant job message
  QUANT_JOB_MSG_TTL = "MQ_QUANT_JOB_MSG_TTL",
  QUANT_JOB_MSG_PREFETCH = "MQ_QUANT_JOB_MSG_PREFETCH_COUNT",
  // quant job dead letter
  QUANT_JOB_DEAD_LETTER_EXCHANGE = "MQ_QUANT_JOB_DEAD_LETTER_EXCHANGE_ID",
  QUANT_JOB_DEAD_LETTER_QUEUE = "MQ_QUANT_JOB_DEAD_LETTER_QUEUE_ID",
  QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE = "MQ_QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE",
}

/**
 * Interface for RabbitMQ environment variables.
 */
export interface RabbitMQEnvVars {
  [RabbitMQConfigKeys.ENV_RABBITMQ_URL]: string;
  /** Executable Task **/
  // exec task queue
  [RabbitMQConfigKeys.EXEC_TASK_QUEUE]: string;
  [RabbitMQConfigKeys.EXEC_TASK_QUEUE_DURABLE]: boolean;
  [RabbitMQConfigKeys.EXEC_TASK_QUEUE_MAXLENGTH]: number;
  // exec task message
  [RabbitMQConfigKeys.EXEC_TASK_MSG_TTL]: number;
  [RabbitMQConfigKeys.EXEC_TASK_MSG_PREFETCH]: number;
  // exec task dead letter
  [RabbitMQConfigKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE]: string;
  [RabbitMQConfigKeys.EXEC_TASK_DEAD_LETTER_QUEUE]: string;
  [RabbitMQConfigKeys.EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE]: boolean;

  // exec storage queue
  [RabbitMQConfigKeys.EXEC_STORAGE_QUEUE]: string;
  [RabbitMQConfigKeys.EXEC_STORAGE_QUEUE_DURABLE]: boolean;
  [RabbitMQConfigKeys.EXEC_STORAGE_QUEUE_MAXLENGTH]: number;
  // exec storage message
  [RabbitMQConfigKeys.EXEC_STORAGE_MSG_TTL]: number;
  [RabbitMQConfigKeys.EXEC_STORAGE_MSG_PREFETCH]: number;
  // exec storage dead letter
  [RabbitMQConfigKeys.EXEC_STORAGE_DEAD_LETTER_EXCHANGE]: string;
  [RabbitMQConfigKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE]: string;
  [RabbitMQConfigKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE_DURABLE]: boolean;

  // quant job queue
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE]: string;
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE_DURABLE]: boolean;
  [RabbitMQConfigKeys.QUANT_JOB_QUEUE_MAXLENGTH]: number;
  // quant job message
  [RabbitMQConfigKeys.QUANT_JOB_MSG_TTL]: number;
  [RabbitMQConfigKeys.QUANT_JOB_MSG_PREFETCH]: number;
  // quant job dead letter
  [RabbitMQConfigKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE]: string;
  [RabbitMQConfigKeys.QUANT_JOB_DEAD_LETTER_QUEUE]: string;
  [RabbitMQConfigKeys.QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE]: boolean;
}
