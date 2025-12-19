import { Module } from "@nestjs/common";
import { ValidationService } from "./validation.service";

/**
 * Nest module providing validation services under the `/q/validate` route scope.
 */
@Module({
  // Register the ValidationService as a provider to make it available for injection throughout the application.
  providers: [ValidationService],
})
export class ValidationModule {}
