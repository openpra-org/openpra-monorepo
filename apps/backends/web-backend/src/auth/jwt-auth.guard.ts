import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: { sub: string; username: string; email: string; roles: string[] };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string; email: string; roles: string[] }>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export type { AuthenticatedRequest };
