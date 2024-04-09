import fs from "fs";
import path from "path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

let mongoDB: MongoMemoryServer | undefined = undefined;

/**
 * Initializes an in-memory MongoDB server and connects Mongoose to it.
 * This function creates a new instance of MongoMemoryServer, retrieves its URI,
 * and then uses that URI to connect Mongoose to the in-memory database.
 *
 * @returns Promise<void> - A promise that resolves when the database is set up and connected.
 */
export const SetupDB: () => Promise<void> = async () => {
  mongoDB = await MongoMemoryServer.create();
  const uri = mongoDB.getUri();
  await mongoose.connect(uri);
};

/**
 * Tears down the in-memory MongoDB server and disconnects Mongoose from it.
 * This function first disconnects Mongoose from the database, and then,
 * if an instance of MongoMemoryServer exists, stops the in-memory MongoDB server.
 *
 * @returns Promise<void> - A promise that resolves when the database is disconnected and the server is stopped.
 */
export const TeardownDB = async (): Promise<void> => {
  await mongoose.disconnect();
  if (mongoDB) {
    await mongoDB.stop();
  }
};

/**
 * Loads data fixtures into the in-memory MongoDB database.
 * This function iterates over a predefined list of collection names,
 * reads the corresponding JSON files from the `../fixtures/seismic/` directory,
 * and inserts the data into the respective collections in the database.
 *
 * The function assumes that the JSON files contain arrays of objects compatible with MongoDB's ObjectId type.
 *
 * @returns Promise<void> - A promise that resolves when all fixtures have been loaded into the database.
 */
export const LoadFixtures = async (): Promise<void> => {
  const collections = ["General_Input", "components", "mainshock_ft"];
  for (const collectionName of collections) {
    const filePath = path.join(
      __dirname,
      `../fixtures/seismic/${collectionName}.json`,
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as ObjectId[];
    const collection = mongoose.connection.collection(collectionName);
    await collection.insertMany(data);
  }
};
