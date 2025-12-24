import { RabbitMQConfigKeys, RabbitMQEnvVars } from './rabbitmq.config';
import { JwtEnvVarKeys, JwtEnvVars } from './jwt.config';
import { MinioConfigKeys, MinioEnvVars } from './minio.config';

export type EnvVarKeys = RabbitMQConfigKeys | JwtEnvVarKeys | MinioConfigKeys;

export const EnvVarKeys = {
  ...RabbitMQConfigKeys,
  ...JwtEnvVarKeys,
  ...MinioConfigKeys,
};

export interface EnvVars extends RabbitMQEnvVars, JwtEnvVars, MinioEnvVars {}
