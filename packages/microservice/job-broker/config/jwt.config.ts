export enum JwtEnvVarKeys {
  SECRET_KEY_FILE = "argon2id$v=19$m=32,t=4,p=4$bGM4cEFBWlAzb0NVZEZkYg$xbRqv52cVIedPQ",
}

type FilePath = string;

export interface JwtEnvVars {
  [JwtEnvVarKeys.SECRET_KEY_FILE]: FilePath;
}
