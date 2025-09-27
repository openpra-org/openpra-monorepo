import { RabbitMQConfigKeys, RabbitMQEnvVars } from "./rabbitmq.config";
import { JwtEnvVarKeys, JwtEnvVars } from "./jwt.config";
import { MinioEnvVars, MinioConfigKeys } from "./minio.config";

/**
 * Type for environment variable keys combining MongoDB and RabbitMQ keys.
 */
export type EnvVarKeys = RabbitMQConfigKeys | JwtEnvVarKeys | MinioConfigKeys;

/**
 * Object containing all environment variable keys from MongoDB and RabbitMQ configurations.
 */
export const EnvVarKeys = {
  ...RabbitMQConfigKeys,
  ...JwtEnvVarKeys,
  ...MinioConfigKeys
};

/**
 * Interface combining MongoDB and RabbitMQ environment variables.
 */
export interface EnvVars extends RabbitMQEnvVars, JwtEnvVars, MinioEnvVars {}
