import { Reflector } from "@nestjs/core";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

/**
 * JWT guard that honors the `@Public()` metadata to bypass authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") implements CanActivate {
  /**
   * @param reflector - NestJS metadata reflector used to check `@Public()`.
   */
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.get<boolean>("isPublic", context.getHandler());
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
