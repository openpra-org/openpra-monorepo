import { TeardownDB } from "./SetupMongoDB";

/**
 * Global teardown function for Jest tests.
 * This module exports an asynchronous function that serves as a global teardown routine
 * in a testing environment, specifically tailored for Jest. It is responsible for shutting down
 * the in-memory MongoDB instance and disconnecting Mongoose from it. This ensures that after
 * the test suite has finished executing, the resources allocated for the in-memory database
 * are properly released, preventing potential memory leaks and ensuring a clean testing environment.
 *
 * @returns Promise<void> - A promise that resolves when the database has been disconnected and the server stopped.
 */
module.exports = async (): Promise<void> => {
  await TeardownDB();
};
