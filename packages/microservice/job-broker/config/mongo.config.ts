/**
 * Enum for MongoDB configuration keys.
 */
export enum MongoDBConfigKeys {
  /**
   * MongoDB URI key.
   */
  MONGODB_URI = 'MONGODB_URI',
  MONGODB_TEST_URI = 'MONGODB_TEST_URI'
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

export const getMongoConfig = () => {
  const config = {
    [MongoDBConfigKeys.MONGODB_URI]: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/openpra',
    [MongoDBConfigKeys.MONGODB_TEST_URI]: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/openpra-test'
  };
  
  // Debug logging
  console.log('MongoDB Configuration:', {
    uri: config[MongoDBConfigKeys.MONGODB_URI],
    testUri: config[MongoDBConfigKeys.MONGODB_TEST_URI],
    envUri: process.env.MONGODB_URI,
    envTestUri: process.env.MONGODB_TEST_URI
  });
  
  return config;
};
