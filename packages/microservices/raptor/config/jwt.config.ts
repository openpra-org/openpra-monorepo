/**
 * Environment variable keys used for JWT configuration.
 */
export enum JwtEnvVarKeys {
  SECRET_KEY_FILE = 'SECRET_KEY_FILE',
}

type FilePath = string;

/**
 * Shape of JWT-related environment variables.
 */
export interface JwtEnvVars {
  /** Absolute or relative path to the secret key file. */
  [JwtEnvVarKeys.SECRET_KEY_FILE]: FilePath;
}
