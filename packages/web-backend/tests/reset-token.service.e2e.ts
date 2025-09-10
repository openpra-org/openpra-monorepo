import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import * as crypto from "crypto";

import { ResetTokenService } from "../src/resetPassword/reset-token.service";
import { ResetToken, ResetTokenSchema } from "../src/resetPassword/schemas/reset-token.schema";

describe("ResetTokenService (e2e)", () => {
  let tokenService: ResetTokenService;
  let connection: Connection;

  const DB_URI = "mongodb://localhost/27017";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DB_URI),
        MongooseModule.forFeature([{ name: ResetToken.name, schema: ResetTokenSchema }]),
      ],
      providers: [ResetTokenService],
    }).compile();

    connection = await module.get(getConnectionToken());
    tokenService = module.get<ResetTokenService>(ResetTokenService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await connection.collection("resettokens").deleteMany({ email: "user@example.com" });
  });

  it("should be defined", () => {
    expect(tokenService).toBeDefined();
  });

  it("generates a token and verifies a valid token and makes it single-use", async () => {
    const token = await tokenService.generateResetToken("user@example.com");
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(64); // 32 bytes hex
    const { email } = await tokenService.verifyResetToken(token);
    expect(email).toBe("user@example.com");

    // second use should fail
    await expect(tokenService.verifyResetToken(token)).rejects.toThrow();
  });

  it("expires token (> 15 min) by manipulating createdAt", async () => {
    const token = await tokenService.generateResetToken("user@example.com");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // set createdAt to past (16 minutes ago)
    const past = new Date(Date.now() - 16 * 60 * 1000);
    await connection.collection("resettokens").updateOne({ tokenHash }, { $set: { createdAt: past } });

    await expect(tokenService.verifyResetToken(token)).rejects.toThrow(/expired/i);
  });
});
