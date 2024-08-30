import { MongoDBConfigKeys, MongoDBEnvVars } from "./mongo.config";
import { RabbitMQConfigKeys, RabbitMQEnvVars } from "./rabbitmq.config";

/**
 * Type for environment variable keys combining MongoDB and RabbitMQ keys.
 */
export type EnvVarKeys = MongoDBConfigKeys | RabbitMQConfigKeys;

/**
 * Object containing all environment variable keys from MongoDB and RabbitMQ configurations.
 */
export const EnvVarKeys = {
  ...RabbitMQConfigKeys,
  ...MongoDBConfigKeys,
};

/**
 * Interface combining MongoDB and RabbitMQ environment variables.
 */
export interface EnvVars extends MongoDBEnvVars, RabbitMQEnvVars {}
