import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";

import { PasswordResetService } from "./passwordreset.service";
import { CollabService } from "../collab/collab.service";
import { PasswordReset } from "./Schema/passwordreset.schema";

describe("PasswordResetService", () => {
  let service: PasswordResetService;
  // We’ll provide a constructable fake model; keep this as 'any' to allow statics & prototype
  let model: any;
  let collab: { isEmailValid: jest.Mock; updatePassword: jest.Mock };

  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, HMAC_SECRET: "test_hmac_secret" };

    collab = {
      isEmailValid: jest.fn(),
      updatePassword: jest.fn(),
    };

    /**
     * Constructable fake Mongoose Model:
     * - `new FakeModel(doc).save()` via prototype.save
     * - static `findOne` / `deleteOne` that return { exec }
     */
    function FakeModel(this: any, doc?: any) {
      if (doc) Object.assign(this, doc);
    }
    (FakeModel as any).prototype.save = jest.fn();

    (FakeModel as any).findOne = jest.fn();
    (FakeModel as any).deleteOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: CollabService, useValue: collab },
        {
          provide: getModelToken(PasswordReset.name),
          useValue: FakeModel,
        },
      ],
    }).compile();

    service = module.get(PasswordResetService);
    model = module.get(getModelToken(PasswordReset.name)) as any;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("constructor", () => {
    it("throws if HMAC_SECRET is missing", async () => {
      // Rebuild the module without HMAC_SECRET
      const build = async () => {
        const mod = await Test.createTestingModule({
          providers: [
            PasswordResetService,
            { provide: CollabService, useValue: collab },
            {
              provide: getModelToken(PasswordReset.name),
              useValue: {},
            },
          ],
        })
          .overrideProvider(PasswordResetService)
          .useClass(PasswordResetService)
          .compile();

        return mod.get(PasswordResetService);
      };

      const old = process.env.HMAC_SECRET;
      delete process.env.HMAC_SECRET;
      await expect(build()).rejects.toThrow("HMAC_SECRET is not defined in environment variables");
      process.env.HMAC_SECRET = old;
    });
  });

  describe("validateEmail", () => {
    it("returns true when CollabService says email exists", async () => {
      // collabService.isEmailValid(email) returns true if NOT in DB (i.e., invalid)
      // validateEmail returns !isInvalid -> invert
      collab.isEmailValid.mockResolvedValue(true); // NOT in DB -> "invalid"
      const ok = await service.validateEmail("x@example.com");
      expect(ok).toBe(false);
      expect(collab.isEmailValid).toHaveBeenCalledWith("x@example.com");
    });

    it("returns false when CollabService says email already present", async () => {
      collab.isEmailValid.mockResolvedValue(false); // already exists -> valid
      const ok = await service.validateEmail("x@example.com");
      expect(ok).toBe(true);
    });
  });

  describe("addPasswordResetEntry", () => {
    it("deletes existing entry (if any), saves new hashed token, and returns plain token", async () => {
      // Arrange: an existing entry is present
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ email: "e@x.com" }) });
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });

      // Capture the last instance that called save so we can inspect the doc
      let lastSavedInstance: any;
      (model.prototype.save as jest.Mock).mockImplementation(function () {
        lastSavedInstance = this;
        return Promise.resolve(undefined);
      });

      const { status, token } = await service.addPasswordResetEntry("e@x.com");

      expect(model.findOne).toHaveBeenCalledWith({ email: "e@x.com" });
      expect(model.deleteOne).toHaveBeenCalledWith({ email: "e@x.com" });
      expect(status).toBe(true);
      expect(typeof token).toBe("string");
      expect(token!.length).toBeGreaterThan(0);

      // Verify the saved document contains the HASH of the returned token
      const expectedHash = crypto
        .createHmac("sha256", process.env.HMAC_SECRET!)
        .update(token!)
        .digest("hex");

      expect(lastSavedInstance).toBeTruthy();
      expect(lastSavedInstance.email).toBe("e@x.com");
      expect(lastSavedInstance.token).toBe(expectedHash);
      expect(lastSavedInstance.expirationTime).toBeInstanceOf(Date);
    });

    it("returns status=false when save fails", async () => {
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 0 }) });

      (model.prototype.save as jest.Mock).mockRejectedValue(new Error("db down"));

      const res = await service.addPasswordResetEntry("e@x.com");
      expect(res.status).toBe(false);
      expect(res.token).toBeNull();
    });
  });

  describe("getUserByToken", () => {
    it("returns doc when hashed token matches and not expired", async () => {
      const plain = "PLAIN_TOKEN";
      const hashed = crypto.createHmac("sha256", process.env.HMAC_SECRET!).update(plain).digest("hex");

      const doc = { email: "e@x.com", token: hashed, expirationTime: new Date(Date.now() + 60000) };
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const found = await service.getUserByToken(plain);
      expect(model.findOne).toHaveBeenCalledWith({
        token: hashed,
        expirationTime: { $gt: expect.any(Date) },
      });
      expect(found).toEqual(doc);
    });

    it("returns null on db error", async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error("boom")),
      });
      const found = await service.getUserByToken("x");
      expect(found).toBeNull();
    });
  });

  describe("updatePassword", () => {
    it("delegates to CollabService.updatePassword", async () => {
      collab.updatePassword.mockResolvedValue(true);
      const ok = await service.updatePassword("e@x.com", "newpass");
      expect(ok).toBe(true);
      expect(collab.updatePassword).toHaveBeenCalledWith("e@x.com", "newpass");
    });
  });

  describe("deleteEntry", () => {
    it("returns true if deletedCount > 0", async () => {
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });
      const ok = await service.deleteEntry("e@x.com");
      expect(ok).toBe(true);
      expect(model.deleteOne).toHaveBeenCalledWith({ email: "e@x.com" });
    });

    it("returns false if delete throws", async () => {
      model.deleteOne.mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error("nope")) });
      const ok = await service.deleteEntry("e@x.com");
      expect(ok).toBe(false);
    });
  });
});
