import { Module } from "@nestjs/common";
import { ValidationService } from "./validation.service";

@Module({
  // Register the ValidationService as a provider to make it available for injection throughout the application.
  providers: [ValidationService],
})
export class ValidationModule {}
