import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";

import { PasswordReset, PasswordResetDocument } from "./Schema/passwordreset.schema";
import { CollabService } from "../collab/collab.service";
import { generateToken } from "./tokenGeneration";

/**
 * Service responsible for handling password reset token generation,
 * validation, and cleanup.
 */
@Injectable()
export class PasswordResetService {
  private readonly expirationDuration: number = 15; // in minutes
  private readonly hmacSecret: string;

  constructor(
    @InjectModel(PasswordReset.name)
    private readonly passwordResetModel: Model<PasswordResetDocument>,
    private readonly collabService: CollabService,
  ) {
    this.hmacSecret = process.env.HMAC_SECRET ?? "";
    if (!this.hmacSecret) {
      throw new Error("HMAC_SECRET is not defined in environment variables");
    }
  }

  /**
   * Generates an expiration Date object 15 minutes from now.
   */
  private getExpirationTime(): Date {
    const expirationMs = Date.now() + this.expirationDuration * 60 * 1000;
    return new Date(expirationMs);
  }

  /**
   * Hashes the given token using HMAC SHA-256 and the configured secret.
   * @param token - Plain token to be hashed
   */
  private hashToken(token: string): string {
    return crypto
      .createHmac("sha256", this.hmacSecret)
      .update(token)
      .digest("hex");
  }

  /**
   * Checks if a password reset entry exists for the given email.
   * @param email - User's email
   * @returns true if entry exists, false otherwise
   */
  async checkEntryExists(email: string): Promise<boolean> {
    try {
      const result = await this.passwordResetModel.findOne({ email }).exec();
      return result !== null;
    } catch (err) {
      console.error("Failed to access the DB", err);
      return false;
    }
  }

  /**
   * Validates whether a given email exists in the user database.
   * @param email - Email to validate
   * @returns true if email exists, false otherwise
   */
  async validateEmail(email: string): Promise<boolean> {
    const isInvalid = await this.collabService.isEmailValid(email);
    return !isInvalid;
  }

  /**
   * Creates or replaces a password reset token for the given email.
   * @param email - User's email
   * @returns status (true if success) and the plain token (null if failed)
   */
  async addPasswordResetEntry(email: string): Promise<{ status: boolean; token: string | null }> {
    const existing = await this.checkEntryExists(email);
    if (existing) {
      try {
        await this.passwordResetModel.deleteOne({ email }).exec();
      } catch (error) {
        console.error("Failed to delete existing reset entry:", error);
      }
    }

    const token = generateToken();
    const hashedToken = this.hashToken(token);
    const expirationTime = this.getExpirationTime();

    const entry = new this.passwordResetModel({ email, token: hashedToken, expirationTime });

    try {
      await entry.save();
      return { status: true, token };
    } catch (error) {
      console.error("Failed to save password reset entry:", error);
      return { status: false, token: null };
    }
  }

  /**
   * Retrieves the user password reset entry by token if it is valid and not expired.
   * @param token - Unhashed token received from user
   * @returns PasswordResetDocument or null
   */
  async getUserByToken(token: string): Promise<PasswordResetDocument | null> {
    const hashedToken = this.hashToken(token);
    try {
      return await this.passwordResetModel
        .findOne({ token: hashedToken, expirationTime: { $gt: new Date() } })
        .exec();
    } catch (err) {
      console.error("Error retrieving reset token from DB:", err);
      return null;
    }
  }

  /**
   * Delegates the password update to the CollabService.
   * @param email - Email of the user
   * @param password - New password
   * @returns true if the password was successfully updated
   */
  async updatePassword(email: string, password: string): Promise<boolean> {
    return await this.collabService.updatePassword(email, password);
  }

  /**
   * Deletes the password reset entry for the given email.
   * @param userEmail - User's email
   * @returns true if the entry was deleted successfully
   */
  async deleteEntry(userEmail: string): Promise<boolean> {
    try {
      const res = await this.passwordResetModel.deleteOne({ email: userEmail }).exec();
      return res.deletedCount > 0;
    } catch (error) {
      console.error("Failed to delete password reset entry:", error);
      return false;
    }
  }
}
