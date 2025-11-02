/**
 * Environment variable keys used for JWT configuration.
 */
export enum JwtEnvVarKeys {
  /**
   * Filesystem path to the secret key used for JWT signing/verification.
   * Note: this is currently a placeholder and should be provided via environment configuration.
   */
  SECRET_KEY_FILE = "argon2id$v=19$m=32,t=4,p=4$bGM4cEFBWlAzb0NVZEZkYg$xbRqv52cVIedPQ", // TODO:: READ AS ENV_VAR
}

type FilePath = string;

/**
 * Shape of JWT-related environment variables.
 */
export interface JwtEnvVars {
  /** Absolute or relative path to the secret key file. */
  [JwtEnvVarKeys.SECRET_KEY_FILE]: FilePath;
}
