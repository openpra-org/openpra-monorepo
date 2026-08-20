import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const [action, identifier] = process.argv.slice(2);
if (!(["grant", "revoke"].includes(action)) || !identifier) {
  console.error("Usage: pnpm admin:grant -- <username-or-email>  OR  pnpm admin:revoke -- <username-or-email>");
  process.exitCode = 1;
} else {
  const fileEnv = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
  const uri = process.env.MONGO_URI || fileEnv.MONGO_URI || "mongodb://127.0.0.1:27017/openpra";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection("users");
    const normalized = identifier.toLowerCase();
    const user = await users.findOne({ $or: [{ username: identifier }, { email: normalized }] });
    if (!user) throw new Error(`Account '${identifier}' was not found`);
    if (action === "revoke") {
      const adminCount = await users.countDocuments({ roles: "admin-role" });
      if (adminCount <= 1 && user.roles?.includes("admin-role")) throw new Error("Cannot revoke the final administrator");
      await users.updateOne({ _id: user._id }, { $pull: { roles: "admin-role" } });
    } else {
      await users.updateOne({ _id: user._id }, { $addToSet: { roles: "admin-role" } });
    }
    await db.collection("sessions").deleteMany({ userId: String(user._id) });
    console.log(`${action === "grant" ? "Granted" : "Revoked"} administrator access for @${user.username}. Existing sessions were revoked.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

