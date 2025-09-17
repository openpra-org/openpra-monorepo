import * as crypto from "crypto";

/**
 * Generates a secure random token using 64 bytes and encodes it in hexadecimal format.
 * Commonly used for password reset tokens or other secure identifiers.
 *
 * @returns A 128-character hexadecimal string
 */
export function generateToken(): string {
  return crypto.randomBytes(64).toString("hex");
}
