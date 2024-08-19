/**
 * Entry point for the Microservice-job-broker application.
 * This script initializes the NestJS application by importing the `JobBrokerModule`.
 * It also sets up a global exception filter using `HttpExceptionFilter` to handle all HTTP exceptions.
 */

// Import necessary modules and components from NestJS and local files.
import { NestFactory } from "@nestjs/core";
import { HttpExceptionFilter } from "shared-types/src/lib/errors/http-exception.filter";
import { JobBrokerModule } from "./job-broker.module";

/**
 * Asynchronously bootstraps the application.
 *
 * This function initializes the NestJS application with the `JobBrokerModule`,
 * applies a global HTTP exception filter for error handling, and starts listening
 * for incoming requests on the specified port (e.g.: 3000).
 *
 * @returns A Promise that resolves when the application has been successfully bootstrapped.
 */
async function bootstrap(): Promise<void> {
  // Create a new NestJS application instance with the JobBrokerModule.
  const app = await NestFactory.create(JobBrokerModule);

  // Apply the HttpExceptionFilter globally to handle all HTTP exceptions.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Start listening for incoming requests on port 3000.
  await app.listen(3000);
}

// Execute the bootstrap function to start the application.
void bootstrap();
