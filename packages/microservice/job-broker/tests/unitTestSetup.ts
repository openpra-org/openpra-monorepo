import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention,no-var
  var __MONGOSERVER__: MongoMemoryServer;
}

/**
 * Global variable to store the instance of the in-memory MongoDB server.
 */
const mongoServer: MongoMemoryServer = new MongoMemoryServer();

/**
 * Asynchronously starts the MongoDB in-memory server and sets the connection URI in the environment variables.
 * This function is typically used in a testing setup to initialize the database before running tests.
 * It also logs the server start and URI to the console.
 */
module.exports = async (): Promise<void> => {
  await mongoServer.start();

  /**
   * Store the MongoDB URI in an environment variable for global access across the application.
   */
  process.env.MONGO_URI = mongoServer.getUri();

  /**
   * Attach the MongoMemoryServer instance to the global object for potential use in other parts of the application.
   */
  global.__MONGOSERVER__ = mongoServer;
};
