import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { AdminGuard } from "../admin.guard";

function contextFor(roles: string[]): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("allows administrators", () => {
    expect(guard.canActivate(contextFor(["member-role", "admin-role"]))).toBe(true);
  });

  it("rejects non-administrators", () => {
    expect(() => guard.canActivate(contextFor(["member-role"]))).toThrow(ForbiddenException);
  });
});

