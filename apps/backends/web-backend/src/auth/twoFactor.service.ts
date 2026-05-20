import { Injectable, OnModuleInit } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import { generateSecret, generateURI, verify } from "otplib";

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5;
const EPOCH_TOLERANCE_SECONDS = 30;
const TIME_OFFSET_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class TwoFactorService implements OnModuleInit {
  private key!: Buffer;
  private timeUrl: string | null = null;
  private timeOffsetMs = 0;
  private offsetFetchedAt = 0;

  onModuleInit(): void {
    const raw = process.env["TFA_ENC_KEY"];
    if (!raw) throw new Error("TFA_ENC_KEY is required but not set");
    this.key = createHash("sha256").update(raw).digest();
    this.timeUrl = process.env["TFA_TIME_URL"] ?? null;
  }

  createSecret(): string {
    return generateSecret();
  }

  buildUri(secret: string, accountLabel: string): string {
    const issuer = process.env["TFA_ISSUER"] ?? "OpenPRA";
    return generateURI({ issuer, label: accountLabel, secret });
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
  }

  decrypt(payload: string): string {
    const parts = payload.split(".");
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const data = Buffer.from(parts[2], "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  }

  async verifyTotp(secret: string, token: string): Promise<boolean> {
    if (this.timeUrl === null) {
      const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE_SECONDS });
      return result.valid;
    }
    const epoch = await this.onlineEpochSeconds();
    const result = await verify({ secret, token, epoch, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  }

  private async onlineEpochSeconds(): Promise<number> {
    if (this.offsetFetchedAt === 0 || Date.now() - this.offsetFetchedAt > TIME_OFFSET_TTL_MS) {
      await this.refreshTimeOffset();
    }
    return Math.floor((Date.now() + this.timeOffsetMs) / 1000);
  }

  private async refreshTimeOffset(): Promise<void> {
    try {
      const response = await fetch(this.timeUrl as string, { method: "GET" });
      const dateHeader = response.headers.get("date");
      if (dateHeader === null) return;
      const realMs = new Date(dateHeader).getTime();
      if (Number.isNaN(realMs)) return;
      this.timeOffsetMs = realMs - Date.now();
      this.offsetFetchedAt = Date.now();
    } catch {
      // time service unreachable: keep the last known offset rather than failing auth
    }
  }

  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
      codes.push(randomBytes(BACKUP_CODE_BYTES).toString("hex"));
    }
    return codes;
  }

  async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => argon2.hash(this.normalizeBackupCode(code))));
  }

  async findBackupCodeIndex(hashes: string[], code: string): Promise<number> {
    const normalized = this.normalizeBackupCode(code);
    for (let i = 0; i < hashes.length; i += 1) {
      const matched = await argon2.verify(hashes[i], normalized);
      if (matched) return i;
    }
    return -1;
  }

  private normalizeBackupCode(code: string): string {
    return code.trim().toLowerCase();
  }
}
