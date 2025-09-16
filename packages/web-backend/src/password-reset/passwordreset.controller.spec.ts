import { Test, TestingModule } from "@nestjs/testing";
import { PasswordResetController } from "./passwordreset.controller";
import { PasswordResetService } from "./passwordreset.service";
import { MailerService } from "./mailer.service";
import { HttpException } from "@nestjs/common";
import { Response } from "express";
import { ThrottlerGuard } from "@nestjs/throttler";

describe("PasswordResetController", () => {
  let controller: PasswordResetController;
  let svc: {
    validateEmail: jest.Mock;
    addPasswordResetEntry: jest.Mock;
    getUserByToken: jest.Mock;
    updatePassword: jest.Mock;
    deleteEntry: jest.Mock;
  };
  let mailer: { sendMail: jest.Mock };

  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, BACKEND_URL: "http://localhost:8000" };

    svc = {
      validateEmail: jest.fn(),
      addPasswordResetEntry: jest.fn(),
      getUserByToken: jest.fn(),
      updatePassword: jest.fn(),
      deleteEntry: jest.fn(),
    };

    mailer = {
      sendMail: jest.fn(),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [
        { provide: PasswordResetService, useValue: svc },
        { provide: MailerService, useValue: mailer },
      ],
    });

    // ✅ Properly override the ThrottlerGuard so Nest doesn't try to construct the real one
    const module: TestingModule = await moduleBuilder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PasswordResetController);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("renderEmailRequestForm", () => {
    it("returns placeholder content", () => {
      expect(controller.renderEmailRequestForm()).toBe("Password Reset Form");
    });
  });

  describe("validatePasswordResetRequest (POST /)", () => {
    it("sends email when email is valid and token is stored", async () => {
      svc.validateEmail.mockResolvedValue(true);
      svc.addPasswordResetEntry.mockResolvedValue({ status: true, token: "TOKEN123" });

      const res = await controller.validatePasswordResetRequest("user@example.com");
      expect(res.message).toMatch(/If an account with that email exists/);
      expect(svc.validateEmail).toHaveBeenCalledWith("user@example.com");
      expect(svc.addPasswordResetEntry).toHaveBeenCalledWith("user@example.com");

      const expectedLink =
        "http://localhost:8000/api/password-reset/create-new-password/?token=TOKEN123";
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject, text, html] = mailer.sendMail.mock.calls[0];
      expect(to).toBe("user@example.com");
      expect(subject).toMatch(/Password Reset Instructions/);
      expect(text).toContain(expectedLink);
      expect(html).toContain(expectedLink);
    });

    it("returns masked success even when email is invalid and does not send", async () => {
      svc.validateEmail.mockResolvedValue(false);
      const res = await controller.validatePasswordResetRequest("nope@example.com");
      expect(res.message).toMatch(/If an account with that email exists/);
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it("returns masked success even if DB store fails", async () => {
      svc.validateEmail.mockResolvedValue(true);
      svc.addPasswordResetEntry.mockResolvedValue({ status: false, token: null });
      const res = await controller.validatePasswordResetRequest("user@example.com");
      expect(res.message).toMatch(/If an account with that email exists/);
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("renderCreateNewPasswordForm (GET /create-new-password)", () => {
    it("redirects to frontend success URL when token is valid", async () => {
      svc.getUserByToken.mockResolvedValue({ email: "user@example.com" });

      const res = { redirect: jest.fn() } as unknown as Response;
      await controller.renderCreateNewPasswordForm("TOKEN123", res);

      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:4200/create-new-password?token=TOKEN123",
      );
    });

    it("redirects to frontend error URL when token invalid", async () => {
      svc.getUserByToken.mockResolvedValue(null);

      const res = { redirect: jest.fn() } as unknown as Response;
      await controller.renderCreateNewPasswordForm("BAD", res);

      expect(res.redirect).toHaveBeenCalledWith("http://localhost:4200/error");
    });
  });

  describe("createNewPassword (POST /create-new-password)", () => {
    it("throws 400 when token or password missing", async () => {
      await expect(controller.createNewPassword("", "x")).rejects.toBeInstanceOf(HttpException);
      await expect(controller.createNewPassword("x", "")).rejects.toBeInstanceOf(HttpException);
    });

    it("throws 400 when token invalid", async () => {
      svc.getUserByToken.mockResolvedValue(null);
      await expect(controller.createNewPassword("newPass!", "BAD")).rejects.toBeInstanceOf(HttpException);
    });

    it("throws 500 if updatePassword fails", async () => {
      svc.getUserByToken.mockResolvedValue({ email: "user@example.com" });
      svc.updatePassword.mockResolvedValue(false);
      await expect(controller.createNewPassword("newPass!", "GOOD")).rejects.toBeInstanceOf(HttpException);
    });

    it("throws 500 if deleteEntry fails after update", async () => {
      svc.getUserByToken.mockResolvedValue({ email: "user@example.com" });
      svc.updatePassword.mockResolvedValue(true);
      svc.deleteEntry.mockResolvedValue(false);
      await expect(controller.createNewPassword("newPass!", "GOOD")).rejects.toBeInstanceOf(HttpException);
    });

    it("sends confirmation email and returns success message on happy path", async () => {
      svc.getUserByToken.mockResolvedValue({ email: "user@example.com" });
      svc.updatePassword.mockResolvedValue(true);
      svc.deleteEntry.mockResolvedValue(true);

      const res = await controller.createNewPassword("StrongP@ssw0rd", "GOOD");
      expect(mailer.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject, text, html] = mailer.sendMail.mock.calls[0];
      expect(to).toBe("user@example.com");
      expect(subject).toMatch(/Password Reset Request Successful/);
      expect(text).toMatch(/successfully reset/i);
      expect(html).toMatch(/Your password has been reset/i);

      expect(res.message).toMatch(/Password reset successful/);
    });
  });
});
