import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResetToken, ResetTokenDocument } from './schemas/reset-token.schema';

@Injectable()
export class ResetTokenService {
  constructor(
    @InjectModel(ResetToken.name)
    private readonly resetTokenModel: Model<ResetTokenDocument>,
  ) {}

  generateResetToken(email: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Save token hash in DB
    this.resetTokenModel.create({
      email,
      tokenHash,
      createdAt: new Date(),
    });

    return token;
  }

  async verifyResetToken(token: string): Promise<{ email: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await this.resetTokenModel.findOne({ tokenHash });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Check expiry (e.g., 15 mins)
    const expiry = 15 * 60 * 1000;
    const now = new Date().getTime();
    const created = new Date(record.createdAt).getTime();

    if (now - created > expiry) {
      await this.resetTokenModel.deleteOne({ _id: record._id });
      throw new UnauthorizedException('Token expired');
    }

    // Delete token after use
    await this.resetTokenModel.deleteOne({ _id: record._id });

    return { email: record.email };
  }
}
