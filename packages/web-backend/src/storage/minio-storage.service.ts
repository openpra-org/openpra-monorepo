import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";
import { Readable } from "stream";

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly logger = new Logger(MinioStorageService.name);

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>("MINIO_OPENPRA_BUCKET");

    this.client = new Minio.Client({
      endPoint: this.config.getOrThrow<string>("MINIO_ENDPOINT"),
      port: Number(this.config.getOrThrow<string>("MINIO_PORT")),
      useSSL: this.config.getOrThrow<string>("MINIO_USE_SSL") === "true",
      accessKey: this.config.getOrThrow<string>("MINIO_ACCESS_KEY"),
      secretKey: this.config.getOrThrow<string>("MINIO_SECRET_KEY"),
    });
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Created bucket: ${this.bucket}`);
    } else {
      this.logger.log(`Bucket ready: ${this.bucket}`);
    }
  }

  getClient(): Minio.Client {
    return this.client;
  }

  getBucket(): string {
    return this.bucket;
  }

  async listObjects(modelId: string, teType: string): Promise<string[]> {
    const prefix = `${modelId}/${teType}/`;
    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    const uuids: string[] = [];
    for await (const obj of stream) {
      if (obj.name) {
        const filename = obj.name.slice(prefix.length);
        uuids.push(filename.replace(/\.json$/, ""));
      }
    }
    return uuids;
  }

  async getObject<T>(modelId: string, teType: string, uuid: string): Promise<T> {
    const key = `${modelId}/${teType}/${uuid}.json`;
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  }

  async putObject(modelId: string, teType: string, uuid: string, data: unknown): Promise<void> {
    const key = `${modelId}/${teType}/${uuid}.json`;
    const body = JSON.stringify(data);
    const stream = Readable.from([body]);
    await this.client.putObject(this.bucket, key, stream, Buffer.byteLength(body), {
      "Content-Type": "application/json",
    });
  }

  async deleteObject(modelId: string, teType: string, uuid: string): Promise<void> {
    const key = `${modelId}/${teType}/${uuid}.json`;
    await this.client.removeObject(this.bucket, key);
  }
}
