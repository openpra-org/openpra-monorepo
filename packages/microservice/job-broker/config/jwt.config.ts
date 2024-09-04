export enum JwtEnvVarKeys {
  SECRET_KEY_FILE = "JWT_SECRET_KEY_FILE",
}

type FilePath = string;

export interface JwtEnvVars {
  [JwtEnvVarKeys.SECRET_KEY_FILE]: FilePath;
}
