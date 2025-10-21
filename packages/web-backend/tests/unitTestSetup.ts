import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  // Allow global for Jest; CJS interop pattern
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
  // Debian 12 (bookworm) ships OpenSSL 3; old MongoDB binaries require OpenSSL 1.1 and will fail.
  // Force a MongoDB binary compatible with OpenSSL 3 by selecting a MongoDB 7.x version.
  const requestedVersion = process.env.MONGOMS_VERSION ?? "7.0.14";
  let mongoServer: MongoMemoryServer;
  try {
    mongoServer = await MongoMemoryServer.create({ binary: { version: requestedVersion } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    // Common failure on Debian 12 (bookworm): missing libcrypto.so.1.1 (OpenSSL 1.1)
    if (message.includes("libcrypto.so.1.1")) {
      // Provide a clear, actionable hint instead of a cryptic error
      // CI sets MONGO_URI and avoids this path entirely.
      const hint = `mongodb-memory-server failed to start: missing libcrypto.so.1.1 (OpenSSL 1.1).
This is common on Debian 12-based dev containers.
Workaround: run tests against an external MongoDB and set MONGO_URI (CI already does this).
For example, run a MongoDB locally and then:
  export MONGO_URI='mongodb://127.0.0.1:27017/test'
Then re-run: pnpm nx test web-backend -- --test-timeout=60000 or run
  MONGO_URI='mongodb://127.0.0.1:27017/test' pnpm -w nx run-many -t test --skip-nx-cache -- --test-timeout=60000`;
      throw new Error(hint);
    }
    throw err;
  }
  process.env.MONGO_URI = mongoServer.getUri();
  global.__MONGOSERVER__ = mongoServer;
};
