import { generate } from "otplib";
import { TwoFactorService } from "../twoFactor.service";

describe("TwoFactorService", () => {
  let service: TwoFactorService;

  beforeAll(() => {
    process.env["TFA_ENC_KEY"] = "test-encryption-key-for-2fa";
  });

  beforeEach(() => {
    service = new TwoFactorService();
    service.onModuleInit();
  });

  it("throws at init when TFA_ENC_KEY is missing", () => {
    const original = process.env["TFA_ENC_KEY"];
    delete process.env["TFA_ENC_KEY"];
    const fresh = new TwoFactorService();
    expect(() => { fresh.onModuleInit(); }).toThrow("TFA_ENC_KEY is required but not set");
    process.env["TFA_ENC_KEY"] = original;
  });

  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = service.createSecret();
    const encrypted = service.encrypt(secret);
    expect(encrypted).not.toBe(secret);
    expect(service.decrypt(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time for the same input", () => {
    const a = service.encrypt("PLAINSECRET");
    const b = service.encrypt("PLAINSECRET");
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe("PLAINSECRET");
    expect(service.decrypt(b)).toBe("PLAINSECRET");
  });

  it("builds an otpauth URI carrying the issuer and secret", () => {
    const secret = service.createSecret();
    const uri = service.buildUri(secret, "ada@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(secret);
  });

  it("accepts a freshly generated TOTP and rejects a wrong one", async () => {
    const secret = service.createSecret();
    const token = await generate({ secret });
    await expect(service.verifyTotp(secret, token)).resolves.toBe(true);
    await expect(service.verifyTotp(secret, "000000")).resolves.toBe(false);
  });

  it("generates ten backup codes and matches a hashed one case-insensitively", async () => {
    const codes = service.generateBackupCodes();
    expect(codes).toHaveLength(10);
    const hashes = await service.hashBackupCodes(codes);
    const index = await service.findBackupCodeIndex(hashes, `  ${codes[3].toUpperCase()}  `);
    expect(index).toBe(3);
    await expect(service.findBackupCodeIndex(hashes, "not-a-code")).resolves.toBe(-1);
  });

  describe("online time source (TFA_TIME_URL)", () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
      delete process.env["TFA_TIME_URL"];
    });

    function withDateHeader(ms: number): typeof fetch {
      return jest.fn().mockResolvedValue({
        headers: { get: (k: string) => (k.toLowerCase() === "date" ? new Date(ms).toUTCString() : null) },
      }) as unknown as typeof fetch;
    }

    it("verifies against the online clock instead of the system clock", async () => {
      const realMs = Date.now() - 3_600_000;
      process.env["TFA_TIME_URL"] = "https://time.example/now";
      global.fetch = withDateHeader(realMs);
      const svc = new TwoFactorService();
      svc.onModuleInit();
      const secret = svc.createSecret();

      const onlineToken = await generate({ secret, epoch: Math.floor(realMs / 1000) });
      await expect(svc.verifyTotp(secret, onlineToken)).resolves.toBe(true);

      const systemToken = await generate({ secret });
      await expect(svc.verifyTotp(secret, systemToken)).resolves.toBe(false);
    });

    it("falls back to the system clock when the time service is unreachable", async () => {
      process.env["TFA_TIME_URL"] = "https://time.example/now";
      global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
      const svc = new TwoFactorService();
      svc.onModuleInit();
      const secret = svc.createSecret();

      const systemToken = await generate({ secret, epoch: Math.floor(Date.now() / 1000) });
      await expect(svc.verifyTotp(secret, systemToken)).resolves.toBe(true);
    });
  });
});
