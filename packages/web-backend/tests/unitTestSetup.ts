import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention,no-var
  var __MONGOSERVER__: MongoMemoryServer | undefined;
}

/**
 * Jest global setup for backend tests.
 * - If MONGO_URI is provided (e.g., in CI with a real MongoDB service), use it and do not start mongodb-memory-server.
 * - Otherwise, start an in-memory MongoDB and expose its URI via process.env.MONGO_URI.
 */
module.exports = async (): Promise<void> => {
  const externalUri = process.env.MONGO_URI;

  if (externalUri && externalUri.length > 0) {
    // Use externally provided MongoDB (e.g., GitHub Actions service)
    return;
  }

  // Local/dev: spin up in-memory MongoDB
  const mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  process.env.MONGO_URI = mongoServer.getUri();
  global.__MONGOSERVER__ = mongoServer;
};
