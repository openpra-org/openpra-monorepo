import { EmailService } from "../email.service";

const createTransportMock = jest.fn();

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: (...args: unknown[]) => createTransportMock(...args) },
  createTransport: (...args: unknown[]) => createTransportMock(...args),
}));

describe("EmailService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    createTransportMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws on init when RESEND_API_KEY is missing", () => {
    delete process.env["RESEND_API_KEY"];
    process.env["MAIL_FROM"] = "noreply@example.com";
    const service = new EmailService();
    expect(() => { service.onModuleInit(); }).toThrow(/RESEND_API_KEY/);
  });

  it("throws on init when MAIL_FROM is missing", () => {
    process.env["RESEND_API_KEY"] = "re_test";
    delete process.env["MAIL_FROM"];
    const service = new EmailService();
    expect(() => { service.onModuleInit(); }).toThrow(/MAIL_FROM/);
  });

  it("creates the SMTP transporter with Resend defaults when env is present", () => {
    process.env["RESEND_API_KEY"] = "re_test_key";
    process.env["MAIL_FROM"] = "noreply@example.com";
    const sendMail = jest.fn();
    createTransportMock.mockReturnValue({ sendMail });
    const service = new EmailService();
    service.onModuleInit();
    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: "re_test_key" },
    });
  });

  it("sends a password reset email containing the reset URL", async () => {
    process.env["RESEND_API_KEY"] = "re_test_key";
    process.env["MAIL_FROM"] = "noreply@example.com";
    process.env["MAIL_FROM_NAME"] = "OpenPRA";
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    createTransportMock.mockReturnValue({ sendMail });

    const service = new EmailService();
    service.onModuleInit();
    await service.sendPasswordResetEmail("user@example.com", "https://app.example/reset?token=xyz");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0] as { from: string; to: string; subject: string; text: string };
    expect(arg.from).toBe('"OpenPRA" <noreply@example.com>');
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toMatch(/reset/i);
    expect(arg.text).toContain("https://app.example/reset?token=xyz");
  });

  it("swallows send errors so caller does not leak failure to clients", async () => {
    process.env["RESEND_API_KEY"] = "re_test_key";
    process.env["MAIL_FROM"] = "noreply@example.com";
    const sendMail = jest.fn().mockRejectedValue(new Error("boom"));
    createTransportMock.mockReturnValue({ sendMail });

    const service = new EmailService();
    service.onModuleInit();
    await expect(
      service.sendPasswordResetEmail("user@example.com", "https://app.example/reset?token=xyz"),
    ).resolves.toBeUndefined();
  });
});
