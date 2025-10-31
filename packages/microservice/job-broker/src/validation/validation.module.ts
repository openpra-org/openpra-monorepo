import { Module } from "@nestjs/common";
import { ValidationService } from "./validation.service";

@Module({
  // Register the ValidationService as a provider to make it available for injection throughout the application.
  providers: [ValidationService],
})
/**
 * Nest module providing validation services under the `/q/validate` route scope.
 */
export class ValidationModule {}
