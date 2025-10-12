import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention,no-var
  var __MONGOSERVER__: MongoMemoryServer | undefined;
}

/**
 * Jest global setup for microservice tests.
 * - Use MONGO_URI if provided (e.g., CI real MongoDB); otherwise start mongodb-memory-server locally.
 */
module.exports = async (): Promise<void> => {
  const externalUri = process.env.MONGO_URI;
  if (externalUri && externalUri.length > 0) {
    return;
  }

  const mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  process.env.MONGO_URI = mongoServer.getUri();
  global.__MONGOSERVER__ = mongoServer;
};
