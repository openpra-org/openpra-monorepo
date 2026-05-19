import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import { randomBytes } from "crypto";

interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  size: number;
  originalName: string;
}

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, mime);
}

function extForMime(mime: string): string {
  return ALLOWED_MIME_TO_EXT[mime];
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Client;
  private bucket!: string;
  private publicUrl!: string;

  onModuleInit(): void {
    const endpoint = process.env["MINIO_ENDPOINT"];
    const portRaw = process.env["MINIO_PORT"];
    const useSslRaw = process.env["MINIO_USE_SSL"];
    const accessKey = process.env["MINIO_ACCESS_KEY"];
    const secretKey = process.env["MINIO_SECRET_KEY"];
    const bucket = process.env["MINIO_BUCKET"];
    const publicUrl = process.env["MINIO_PUBLIC_URL"];

    if (!endpoint) throw new Error("MINIO_ENDPOINT is required but not set");
    if (!accessKey) throw new Error("MINIO_ACCESS_KEY is required but not set");
    if (!secretKey) throw new Error("MINIO_SECRET_KEY is required but not set");
    if (!bucket) throw new Error("MINIO_BUCKET is required but not set");
    if (!publicUrl) throw new Error("MINIO_PUBLIC_URL is required but not set");

    const port = portRaw !== undefined && portRaw.length > 0 ? Number(portRaw) : undefined;
    const useSSL = useSslRaw === "true";

    this.client = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/+$/, "");

    void this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, "us-east-1");
        this.logger.log(`Created bucket: ${this.bucket}`);
      }
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
    } catch (err) {
      this.logger.error(`Bucket bootstrap failed for "${this.bucket}"`, err);
    }
  }

  isAllowedMime(mime: string): boolean {
    return isAllowedMime(mime);
  }

  async uploadImage(folder: string, username: string, input: UploadInput): Promise<string> {
    if (!isAllowedMime(input.mimeType)) {
      throw new Error("Unsupported image type");
    }
    const id = randomBytes(8).toString("hex");
    const key = `${folder}/${username}/${id}.${extForMime(input.mimeType)}`;
    await this.client.putObject(this.bucket, key, input.buffer, input.size, {
      "Content-Type": input.mimeType,
    });
    return key;
  }

  async deleteByKey(key: string | null | undefined): Promise<void> {
    if (key === null || key === undefined || key.length === 0) return;
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      this.logger.warn(`Failed to delete object "${key}"`, err);
    }
  }

  urlForKey(key: string | null | undefined): string | null {
    if (key === null || key === undefined || key.length === 0) return null;
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }
}
