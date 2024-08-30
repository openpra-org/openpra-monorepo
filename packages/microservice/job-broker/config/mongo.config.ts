/**
 * Enum for MongoDB configuration keys.
 */
export enum MongoDBConfigKeys {
  /**
   * MongoDB URI key.
   */
  MONGODB_URI = "MONGO_URL",
}

/**
 * Interface for MongoDB environment variables.
 */
export interface MongoDBEnvVars {
  /**
   * MongoDB URI.
   */
  [MongoDBConfigKeys.MONGODB_URI]: string;
}
