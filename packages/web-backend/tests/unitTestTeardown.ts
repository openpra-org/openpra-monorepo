import { MongoMemoryServer } from "mongodb-memory-server";
declare global {
  var __MONGOSERVER__: MongoMemoryServer | undefined;
}
module.exports = async (): Promise<void> => {
  try {
    if (global.__MONGOSERVER__) {
      await global.__MONGOSERVER__.stop();
    }
  } catch {
    return;
  }
};
