import { MinioConfigKeys, MinioEnvVars } from "./minio.config";

export type EnvVarkeys = MinioConfigKeys
export const EnvVarKeys = {
    ...MinioConfigKeys
};
export interface EnvVars extends MinioEnvVars {}