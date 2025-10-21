import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  var __MONGOSERVER__: MongoMemoryServer | undefined;
}

/**
 * Asynchronously stops the MongoDB in-memory server and logs the action to the console.
 * This function is typically used in a testing teardown to clean up the database after running tests.
 */
module.exports = async (): Promise<void> => {
  try {
    /**
     * Stop the MongoMemoryServer instance.
     */
    if (global.__MONGOSERVER__) {
      await global.__MONGOSERVER__.stop();
    }
  } catch {
    return;
  }
};
