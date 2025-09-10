import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as crypto from 'crypto';

@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const raw = (req?.body?.email ?? '').toString().trim().toLowerCase();

    if (raw) {
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      return `email:${hash}`;
    }

    // Fallback when no email is provided (avoid bucketing everyone together)
    return `ip:${this.extractIp(req)}`;
  }

  private extractIp(req: any): string {
    const xff = req?.headers?.['x-forwarded-for'];
    const forwarded = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    const Ip = req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress;
    return forwarded || Ip || 'unknown';
  }
}
