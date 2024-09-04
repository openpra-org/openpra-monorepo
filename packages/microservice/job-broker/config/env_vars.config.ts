import { MongoDBConfigKeys, MongoDBEnvVars } from "./mongo.config";
import { RabbitMQConfigKeys, RabbitMQEnvVars } from "./rabbitmq.config";
import { JwtEnvVarKeys, JwtEnvVars } from "./jwt.config";

/**
 * Type for environment variable keys combining MongoDB and RabbitMQ keys.
 */
export type EnvVarKeys = MongoDBConfigKeys | RabbitMQConfigKeys | JwtEnvVarKeys;

/**
 * Object containing all environment variable keys from MongoDB and RabbitMQ configurations.
 */
export const EnvVarKeys = {
  ...RabbitMQConfigKeys,
  ...MongoDBConfigKeys,
  ...JwtEnvVarKeys,
};

/**
 * Interface combining MongoDB and RabbitMQ environment variables.
 */
export interface EnvVars extends MongoDBEnvVars, RabbitMQEnvVars, JwtEnvVars {}
