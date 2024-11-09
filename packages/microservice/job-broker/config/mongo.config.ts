/**
 * Enum for MongoDB configuration keys.
 */
export enum MongoDBConfigKeys {
  /**
   * MongoDB URI key.
   */
  MONGODB_URI = "mongodb://mongodb:27017",
  MONGODB_TEST_URI = "mongodb://mongodb:27017/test",
}

/**
 * Interface for MongoDB environment variables.
 */
export interface MongoDBEnvVars {
  /**
   * MongoDB URI.
   */
  [MongoDBConfigKeys.MONGODB_URI]: string;
  [MongoDBConfigKeys.MONGODB_TEST_URI]: string;
}
