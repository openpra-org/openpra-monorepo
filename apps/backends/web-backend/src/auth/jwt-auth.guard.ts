import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SessionsService } from "../sessions/sessions.service";

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: { sub: string; username: string; email: string; roles: string[]; jti: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string; email: string; roles: string[]; jti?: string; tfaPending?: boolean }>(token);
      if (payload.tfaPending === true) throw new UnauthorizedException();
      if (!(await this.sessions.isActive(payload.jti))) throw new UnauthorizedException();
      req.user = { sub: payload.sub, username: payload.username, email: payload.email, roles: payload.roles, jti: payload.jti as string };
      void this.sessions.touch(payload.jti as string);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export type { AuthenticatedRequest };
