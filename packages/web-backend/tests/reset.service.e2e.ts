import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import * as argon2 from "argon2";

import { ResetPasswordService } from "../src/resetPassword/reset.service";
import { ResetTokenService } from "../src/resetPassword/reset-token.service";

import { ResetToken, ResetTokenSchema } from "../src/resetPassword/schemas/reset-token.schema";
import { CollabService } from "../src/collab/collab.service";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../src/collab/schemas/user-counter.schema";
import { MailService } from "../src/mail/mail.service";

// Mock MailService so no real emails are sent
class MockMailService {
  public sent: { to: string; link: string }[] = [];
  async sendPasswordResetEmail(to: string, resetLink: string) {
    this.sent.push({ to, link: resetLink });
  }
}

describe("ResetPasswordService (e2e)", () => {
  let resetService: ResetPasswordService;
  let tokenService: ResetTokenService;
  let collabService: CollabService;
  let mailService: MockMailService;
  let connection: Connection;

  // correct URI (colon after localhost)
  const DB_URI = "mongodb://localhost:27017";

  beforeEach(async () => {
    mailService = new MockMailService();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DB_URI),
        MongooseModule.forFeature([
          { name: ResetToken.name, schema: ResetTokenSchema },
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [
        ResetPasswordService,
        ResetTokenService,
        CollabService,
        // override the provider with our mock cleanly
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    connection = await module.get(getConnectionToken());
    resetService = module.get<ResetPasswordService>(ResetPasswordService);
    tokenService = module.get<ResetTokenService>(ResetTokenService);
    collabService = module.get<CollabService>(CollabService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await connection.collection("users").deleteMany({ username: "resetUser" });
    await connection.collection("resettokens").deleteMany({ email: "reset@example.com" });
    mailService.sent = [];
  });

  async function createUser(): Promise<any> {
    const user = {
      firstName: "Reset",
      lastName: "User",
      email: "reset@example.com",
      username: "resetUser",
      password: "InitialPass123!",
      roles: ["member"], // keep roles if your schema requires it
    };
    return collabService.createNewUser(user);
  }

  it("requestPasswordReset: does nothing for unknown email (no leak) and sends for known email", async () => {
    // unknown email -> should not throw and should not send
    await expect(resetService.requestPasswordReset("nouser@example.com")).resolves.toBeUndefined();
    expect(mailService.sent.length).toBe(0);

    await createUser();

    // known email -> should send and store token
    await resetService.requestPasswordReset("reset@example.com");
    expect(mailService.sent.length).toBe(1);
    expect(mailService.sent[0].to).toBe("reset@example.com");
    expect(mailService.sent[0].link).toMatch(/\/reset-password\?token=/);

    const tokens = await connection.collection("resettokens").find({ email: "reset@example.com" }).toArray();
    expect(tokens.length).toBe(1);
  });

  it("resetPassword: updates the user's password and token is single-use", async () => {
    await createUser();

    // ask for reset to get an email with token
    await resetService.requestPasswordReset("reset@example.com");
    const link = mailService.sent[0].link;
    const token = new URL(link).searchParams.get("token") || "";

    await resetService.resetPassword(token, "NewPass!234");

    // verify password actually changed
    const user = await collabService.loginUser("resetUser");
    const okNew = await argon2.verify(user.password, "NewPass!234");
    expect(okNew).toBe(true);

    // token should be single-use
    await expect(resetService.resetPassword(token, "AnotherPass!")).rejects.toThrow();
  });

  it("resetPassword: invalid token fails", async () => {
    await expect(resetService.resetPassword("BADTOKEN", "NewPass!234")).rejects.toThrow();
  });
});
