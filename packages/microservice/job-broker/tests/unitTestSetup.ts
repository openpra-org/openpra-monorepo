import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "node:fs";
import net from "node:net";

function isDebian12(): boolean {
  try {
    const content = fs.readFileSync("/etc/os-release", "utf8");
    return (
      /ID=debian/.test(content) && (/VERSION_ID=\"?12\"?/.test(content) || /VERSION_CODENAME=bookworm/.test(content))
    );
  } catch {
    return false;
  }
}

function libcrypto11Present(): boolean {
  const candidates = ["/usr/lib/x86_64-linux-gnu/libcrypto.so.1.1", "/lib/x86_64-linux-gnu/libcrypto.so.1.1"];
  return candidates.some((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

async function canConnectLocalMongo(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeoutMs = 250;
    socket.setTimeout(timeoutMs);
    socket
      .once("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .once("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .once("error", () => {
        resolve(false);
      })
      .connect(27017, "127.0.0.1");
  });
}

declare global {
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

  if (isDebian12() && !libcrypto11Present()) {
    if (await canConnectLocalMongo()) {
      const fallbackUri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/test";
      process.env.MONGO_URI = fallbackUri;
      console.warn("Detected Debian 12 without libcrypto 1.1; using local MongoDB via MONGO_URI=" + fallbackUri);
      return;
    }
    console.warn(
      "Detected Debian 12 without libcrypto 1.1. mongodb-memory-server may fail. " +
        "Start a local MongoDB and set MONGO_URI (e.g., mongodb://127.0.0.1:27017/test).",
    );
  }

  const requestedVersion = process.env.MONGOMS_VERSION ?? "7.0.14";
  let mongoServer: MongoMemoryServer;
  try {
    mongoServer = await MongoMemoryServer.create({ binary: { version: requestedVersion } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("libcrypto.so.1.1")) {
      const hint = `mongodb-memory-server failed to start: missing libcrypto.so.1.1 (OpenSSL 1.1).
This is common on Debian 12-based dev containers.
Workaround: run tests against an external MongoDB and set MONGO_URI (CI already does this).
For example, run a MongoDB locally and then:
  export MONGO_URI='mongodb://127.0.0.1:27017/test'
Then re-run: pnpm nx run microservice-job-broker:e2e --skip-nx-cache`;
      throw new Error(hint);
    }
    throw err;
  }
  process.env.MONGO_URI = mongoServer.getUri();
  global.__MONGOSERVER__ = mongoServer;
};
