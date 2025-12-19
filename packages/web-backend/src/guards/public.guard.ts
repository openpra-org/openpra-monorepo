import { SetMetadata } from "@nestjs/common";

/**
 * Decorator to mark a route as public, skipping JWT authentication.
 */
export const Public = () => SetMetadata("isPublic", true);
