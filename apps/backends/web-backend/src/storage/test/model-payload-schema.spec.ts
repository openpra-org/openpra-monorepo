import { createConnection, Schema, type Connection, type Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stringifyJson } from "interfaces-shared-types/json";
import { modelPayloadSchema, workbookPayloadFields } from "../model-payload-schema";
import { INLINE_PAYLOAD_BYTES, modelPayloadStore } from "../model-payload-store";

describe("MinIO model payload persistence boundary", () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let model: Model<any>;
  const objects = new Map<string, string>();
  const large = () => ({ uuid: "source-id", probability: -0, data: "x".repeat(17 * 1024 * 1024) });
  let put: jest.SpyInstance;
  let get: jest.SpyInstance;

  beforeAll(async () => {
    put = jest.spyOn(modelPayloadStore, "put").mockImplementation(async (value) => {
      const text = stringifyJson(value);
      if (!text || Buffer.byteLength(text) < INLINE_PAYLOAD_BYTES) return undefined;
      const key = String(objects.size);
      objects.set(key, text);
      return { format: "json-gzip-v1", key, sha256: "test", bytes: text.length };
    });
    get = jest.spyOn(modelPayloadStore, "get").mockImplementation(async ({ key }) => {
      if (!objects.has(key)) throw new Error("Missing object");
      return JSON.parse(objects.get(key)!);
    });
    mongo = await MongoMemoryServer.create();
    connection = await createConnection(mongo.getUri()).asPromise();
    const schema = new Schema({
      workbookId: { type: String, unique: true }, revision: Number,
      mef: { type: Object, required: true }, previousMefJson: String,
      result: Object, snapshots: { type: [Object], immutable: true },
      target: Object, contributions: [Object],
    }, { minimize: false });
    modelPayloadSchema(schema, { ...workbookPayloadFields, result: () => ({}), snapshots: () => [], target: () => ({}), contributions: () => [] });
    model = connection.model("PayloadTest", schema);
    await model.init();
  });
  afterAll(async () => { put.mockRestore(); get.mockRestore(); await connection.close(); await mongo.stop(); });
  beforeEach(async () => { await model.deleteMany({}); });

  it("saves, reads and queries a workbook larger than BSON, preserving signed zero", async () => {
    const doc = await model.create({ workbookId: "large", revision: 1, mef: large() });
    expect(doc.mef.data.length).toBe(17 * 1024 * 1024);
    const stored = await model.collection.findOne({ workbookId: "large" });
    expect(stored!.mef).toEqual({ uuid: "source-id" });
    expect(stored!.modelPayloadReferences.mef).toBeDefined();
    const read = await model.findOne({ "mef.uuid": "source-id" }).lean();
    expect(read!.mef).toEqual(doc.mef);
    expect(Object.is(read!.mef.probability, -0)).toBe(true);
  });

  it("keeps legacy inline data readable and externalizes it on its next save", async () => {
    const mef = { uuid: "legacy", data: "a".repeat(2 * INLINE_PAYLOAD_BYTES) };
    await model.collection.insertOne({ workbookId: "legacy", revision: 1, mef });
    const doc = await model.findOne({ workbookId: "legacy" });
    expect(doc!.mef).toEqual(mef);
    await doc!.save();
    expect((await model.collection.findOne({ workbookId: "legacy" }))!.modelPayloadReferences.mef).toBeDefined();
    expect((await model.findOne({ workbookId: "legacy" }))!.mef).toEqual(mef);
  });

  it("preserves atomic revision conflicts and clears stale references for small replacements", async () => {
    await model.create({ workbookId: "revision", revision: 1, mef: large() });
    const revisions = await Promise.all(["first", "second"].map((uuid) => model.findOneAndUpdate(
      { workbookId: "revision", revision: 1 }, { $set: { mef: { uuid }, revision: 2 } }, { new: true },
    )));
    expect(revisions.filter(Boolean)).toHaveLength(1);
    const stored = await model.collection.findOne({ workbookId: "revision" });
    expect(stored!.modelPayloadReferences?.mef).toBeUndefined();
    expect((await model.findOne({ workbookId: "revision" }))!.mef).toEqual(revisions.find(Boolean)!.mef);
  });

  it("supports projected lean reads and skips downloads for metadata projections", async () => {
    await model.create({ workbookId: "projection", mef: large() });
    const calls = get.mock.calls.length;
    await model.findOne({ workbookId: "projection" }).select({ workbookId: 1 }).lean();
    expect(get.mock.calls.length).toBe(calls);
    expect((await model.find({}, { workbookId: 1, mef: 1 }).lean())[0].mef.data).toHaveLength(17 * 1024 * 1024);
    expect((await model.findOne().select({ result: 0 }).lean())!.mef.data).toHaveLength(17 * 1024 * 1024);
  });

  it("stores batch snapshots and large results and protects immutable history", async () => {
    const input = { workbookId: "batch", mef: {}, snapshots: [large()] };
    const [doc] = await model.insertMany([input]);
    expect(input.snapshots[0].data.length).toBe(17 * 1024 * 1024);
    expect(doc.snapshots[0].data.length).toBe(17 * 1024 * 1024);
    await doc.save();
    await model.updateOne({ workbookId: "batch" }, { $set: { result: large() } });
    expect((await model.findOne())!.result.data.length).toBe(17 * 1024 * 1024);
    await expect(model.updateOne({}, { $set: { snapshots: [] } })).rejects.toThrow("immutable");
    await expect(model.updateOne({}, { $set: { "mef.uuid": "changed" } })).rejects.toThrow("complete model payload");
  });

  it("rejects saving partial or metadata-only reads and prevents bulk writes bypassing storage", async () => {
    await model.create({ workbookId: "partial", mef: large() });
    const partial = await model.findOne().select({ workbookId: 1 });
    await expect(partial!.save()).rejects.toThrow("complete model document");
    const metadata = await model.findOne().setOptions({ modelPayloadMetadataOnly: true });
    await expect(metadata!.save()).rejects.toThrow("complete model document");
    await expect(model.bulkWrite([{ updateOne: { filter: {}, update: { $set: { mef: {} } } } }])).rejects.toThrow("explicit field updates");
    expect((await model.findOne())!.mef.data.length).toBe(17 * 1024 * 1024);
  });

  it("retains large provenance fields in history metadata without reading model/result blobs", async () => {
    await model.create({ workbookId: "provenance", mef: large(), result: large(), target: large(), contributions: [large()] });
    const calls = get.mock.calls.length;
    const metadata = await model.findOne().setOptions({ modelPayloadMetadataOnly: true });
    expect(get.mock.calls.length - calls).toBe(2);
    expect(metadata!.mef).toEqual({ uuid: "source-id" });
    expect(metadata!.result).toEqual({});
    expect(metadata!.target.data).toHaveLength(17 * 1024 * 1024);
    expect(metadata!.contributions[0].data).toHaveLength(17 * 1024 * 1024);
  });

  it("supports full replacement and previous-workbook restoration", async () => {
    await model.replaceOne({ workbookId: "restore" }, { workbookId: "restore", mef: {}, previousMefJson: stringifyJson(large()) }, { upsert: true });
    const doc = await model.findOne({ workbookId: "restore" });
    expect(Object.is(JSON.parse(doc!.previousMefJson).probability, -0)).toBe(true);
    await model.findOneAndReplace({ workbookId: "restore" }, { workbookId: "restore", mef: large() }, { new: true });
    expect((await model.findOne())!.mef.data.length).toBe(17 * 1024 * 1024);
  });

  it("fails closed on missing objects and leaves the database intact on failed uploads", async () => {
    await model.create({ workbookId: "failure", revision: 1, mef: {} });
    put.mockRejectedValueOnce(new Error("upload failed"));
    await expect(model.updateOne({}, { $set: { mef: large(), revision: 2 } })).rejects.toThrow("upload failed");
    expect((await model.findOne())!.revision).toBe(1);
    await model.updateOne({}, { $set: { mef: large() } });
    get.mockRejectedValueOnce(new Error("Missing object"));
    await expect(model.findOne()).rejects.toThrow("Missing object");
    expect((await model.findOne())!.mef.data.length).toBe(17 * 1024 * 1024);
  });

  it("restores caller values after a failed document save and allows a retry", async () => {
    const doc = new model({ workbookId: "retry", mef: large() });
    put.mockRejectedValueOnce(new Error("upload failed"));
    await expect(doc.save()).rejects.toThrow("upload failed");
    expect(doc.mef.data.length).toBe(17 * 1024 * 1024);
    await doc.save();
    expect((await model.findOne())!.mef.data.length).toBe(17 * 1024 * 1024);
  });
});
