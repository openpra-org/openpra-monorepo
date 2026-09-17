import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { Client } from "minio";
import { INLINE_PAYLOAD_BYTES, ModelPayloadStore } from "../model-payload-store";

jest.mock("minio", () => ({ Client: jest.fn() }));

describe("model payload encoding and integrity", () => {
  const objects = new Map<string, Buffer>();
  let client: { bucketExists: jest.Mock; makeBucket: jest.Mock; putObject: jest.Mock; getObject: jest.Mock };
  const savedEnv = { ...process.env };
  beforeEach(() => {
    objects.clear();
    process.env["MINIO_ENDPOINT"] = "storage.test";
    process.env["MINIO_ACCESS_KEY"] = "test";
    process.env["MINIO_SECRET_KEY"] = "test-secret";
    client = {
      bucketExists: jest.fn(async () => true), makeBucket: jest.fn(),
      putObject: jest.fn(async (_bucket, key, data) => { objects.set(key, data); }),
      getObject: jest.fn(async (_bucket, key) => Readable.from([objects.get(key)!])),
    };
    (Client as jest.Mock).mockImplementation(() => client);
  });
  afterAll(() => { process.env = savedEnv; });

  it("round-trips binary64 values, empty objects and long Unicode strings across fresh clients", async () => {
    const value = { values: [0, -0, Number.MIN_VALUE, Number.MAX_VALUE, 0.09999999999999999], empty: {}, text: "λ".repeat(INLINE_PAYLOAD_BYTES) };
    const reference = await new ModelPayloadStore().put(value);
    expect(reference).toBeDefined();
    expect(await new ModelPayloadStore().get(reference!)).toEqual(value);
    expect((await new ModelPayloadStore().put(value))!.key).toBe(reference!.key);
    expect(reference!.bytes).toBeGreaterThan(2 * INLINE_PAYLOAD_BYTES);
  });

  it("uses BSON size as well as JSON size to protect compact numeric arrays", async () => {
    expect(await new ModelPayloadStore().put(new Array(100_000).fill(0))).toBeDefined();
    expect(await new ModelPayloadStore().put({ small: -0 })).toBeUndefined();
  });

  it("does not connect for small values and gives an explicit error for missing configuration", async () => {
    delete process.env["MINIO_ENDPOINT"];
    const store = new ModelPayloadStore();
    expect(await store.put({ small: -0 })).toBeUndefined();
    await expect(store.put("a".repeat(INLINE_PAYLOAD_BYTES))).rejects.toThrow("Unable to store model payload");
  });

  it("rejects missing, corrupt, wrong-sized and substituted objects", async () => {
    const store = new ModelPayloadStore();
    const reference = (await store.put("a".repeat(INLINE_PAYLOAD_BYTES)))!;
    const original = objects.get(reference.key)!;
    for (const corrupt of [Buffer.from("not gzip"), gzipSync('"small"'), gzipSync('"' + "b".repeat(INLINE_PAYLOAD_BYTES) + '"')]) {
      objects.set(reference.key, corrupt);
      await expect(store.get(reference)).rejects.toThrow("Unable to read verified model payload");
    }
    objects.set(reference.key, original);
    client.getObject.mockRejectedValueOnce(new Error("missing object"));
    await expect(store.get(reference)).rejects.toThrow("Unable to read verified model payload");
    expect(await store.get(reference)).toBe("a".repeat(INLINE_PAYLOAD_BYTES));
    await expect(store.get({ ...reference, key: "another-bucket/key" })).rejects.toThrow("Unable to read verified model payload");
  });

  it("recovers after bucket initialization and upload failures", async () => {
    const store = new ModelPayloadStore();
    client.bucketExists.mockRejectedValueOnce(new Error("offline"));
    await expect(store.put("a".repeat(INLINE_PAYLOAD_BYTES))).rejects.toThrow("Unable to store model payload");
    client.putObject.mockRejectedValueOnce(new Error("upload failed"));
    await expect(store.put("a".repeat(INLINE_PAYLOAD_BYTES))).rejects.toThrow("Unable to store model payload");
    expect(await store.put("a".repeat(INLINE_PAYLOAD_BYTES))).toBeDefined();
  });
});
