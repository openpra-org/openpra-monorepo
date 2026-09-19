import { ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { Client } from "minio";
import { mongo } from "mongoose";
import { stringifyJson } from "interfaces-shared-types/json";

const compress = promisify(gzip);
const decompress = promisify(gunzip);
export const INLINE_PAYLOAD_BYTES = 1024 * 1024;

export interface ModelPayloadReference {
  format: "json-gzip-v1";
  key: string;
  sha256: string;
  bytes: number;
}

/** Large model data belongs in MinIO; MongoDB holds its immutable reference. */
export class ModelPayloadStore {
  private client?: Client;
  private ready?: Promise<void>;
  private bucket = "openpra-model-payloads";

  private async connect(): Promise<Client> {
    if (!this.client) {
      const endpoint = process.env["MINIO_ENDPOINT"];
      const accessKey = process.env["MINIO_ACCESS_KEY"];
      const secretKey = process.env["MINIO_SECRET_KEY"];
      if (!endpoint || !accessKey || !secretKey) {
        throw new Error("MinIO connection settings are required for large model payloads");
      }
      this.bucket = process.env["MINIO_MODEL_PAYLOADS_BUCKET"] ?? this.bucket;
      this.client = new Client({
        endPoint: endpoint,
        port: Number(process.env["MINIO_PORT"] ?? 9000),
        useSSL: process.env["MINIO_USE_SSL"] === "true",
        accessKey,
        secretKey,
      });
    }
    const client = this.client;
    this.ready ??= (async () => {
      if (await client.bucketExists(this.bucket)) return;
      try {
        await client.makeBucket(this.bucket);
      } catch (error) {
        // Another backend may have created the bucket concurrently.
        if (!await client.bucketExists(this.bucket)) throw error;
      }
    })().catch((error: unknown) => { this.ready = undefined; throw error; });
    await this.ready;
    return client;
  }

  async put(value: unknown): Promise<ModelPayloadReference | undefined> {
    const text = stringifyJson(value);
    if (text === undefined) return undefined;
    const data = Buffer.from(text);
    if (data.length < INLINE_PAYLOAD_BYTES && mongo.BSON.calculateObjectSize({ value }) < INLINE_PAYLOAD_BYTES) return undefined;
    try {
      const client = await this.connect();
      const sha256 = createHash("sha256").update(data).digest("hex");
      const key = `v1/${sha256}.json.gz`;
      const compressed = await compress(data, { level: 1 });
      // Content addressing shares identical snapshots and never overwrites other data.
      await client.putObject(this.bucket, key, compressed, compressed.length, {
        "Content-Type": "application/gzip",
      });
      return { format: "json-gzip-v1", key, sha256, bytes: data.length };
    } catch (error) {
      throw new ServiceUnavailableException("Unable to store model payload in MinIO", { cause: error });
    }
  }

  async get(reference: ModelPayloadReference): Promise<unknown> {
    try {
      if (reference.format !== "json-gzip-v1" || !/^[a-f0-9]{64}$/.test(reference.sha256)
        || reference.key !== `v1/${reference.sha256}.json.gz`
        || !Number.isSafeInteger(reference.bytes) || reference.bytes < 1) {
        throw new Error("Invalid model payload reference");
      }
      const client = await this.connect();
      const stream = await client.getObject(this.bucket, reference.key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const data = await decompress(Buffer.concat(chunks), { maxOutputLength: reference.bytes });
      if (data.length !== reference.bytes || createHash("sha256").update(data).digest("hex") !== reference.sha256) {
        throw new Error("Model payload checksum mismatch");
      }
      return JSON.parse(data.toString("utf8")) as unknown;
    } catch (error) {
      throw new ServiceUnavailableException("Unable to read verified model payload from MinIO", { cause: error });
    }
  }
}

export const modelPayloadStore = new ModelPayloadStore();
