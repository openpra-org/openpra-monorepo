import { SetupDB, LoadFixtures } from "./SetupMongoDB";

/**
 * Global setup function for Jest tests.
 * This module exports an asynchronous function that is intended to be used as a global setup routine
 * in a testing environment, specifically designed for Jest. It sequentially performs the setup of an
 * in-memory MongoDB instance and then loads predefined data fixtures into the database.
 * This setup process ensures that each test run starts with a fresh, pre-populated database state.
 *
 * @returns Promise<void> - A promise that resolves when the database setup and fixture loading are complete.
 */
module.exports = async (): Promise<void> => {
  await SetupDB();
  await LoadFixtures();
};
