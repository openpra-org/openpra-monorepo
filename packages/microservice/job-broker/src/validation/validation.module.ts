/**
 * Defines the Validation module for the application.
 *
 * This module is responsible for providing validation services throughout the application.
 * It encapsulates all validation logic and can be imported into other modules
 * to utilize the validation functionalities provided by `ValidationService`.
 */

// Import necessary modules, services, and controllers from NestJS and local files.
import { Module } from "@nestjs/common";
import { ValidationService } from "./validation.service";

@Module({
  // Register the ValidationService as a provider to make it available for injection throughout the application.
  providers: [ValidationService],
})
export class ValidationModule {}
