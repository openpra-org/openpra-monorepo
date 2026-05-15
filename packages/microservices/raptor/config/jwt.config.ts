export enum JwtEnvVarKeys {
  SECRET_KEY_FILE = "SECRET_KEY_FILE",
}
type FilePath = string;
export interface JwtEnvVars {
  [JwtEnvVarKeys.SECRET_KEY_FILE]: FilePath;
}
