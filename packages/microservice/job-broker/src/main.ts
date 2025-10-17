import { NestFactory } from "@nestjs/core";
import { NestiaSwaggerComposer } from "@nestia/sdk";
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { INestApplication, Logger } from "@nestjs/common";
import { json, urlencoded } from "express";
import { HttpExceptionFilter } from "./http-exception.filter";
import { JobBrokerModule } from "./job-broker.module";

// Setup global error handlers to prevent process crashes
const logger = new Logger('ProcessErrorHandler');

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception detected:', error);
  logger.error('Stack trace:', error.stack);
  // Don't exit - let the consumer continue running
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection detected at:', promise);
  logger.error('Rejection reason:', reason);
  // Don't exit - let the consumer continue running
});

/**
 * Asynchronously bootstraps the application.
 *
 * This function initializes the NestJS application by creating an instance of the `JobBrokerModule`
 * and starts listening for incoming HTTP requests on a specified port (default is 3000).
 *
 * @remarks
 * The `bootstrap` function is an asynchronous function, which allows for asynchronous operations
 * that may be required during the application initialization phase (e.g., database connections,
 * configuration loading, etc.).
 *
 * @returns A Promise that resolves when the application has been successfully bootstrapped and is
 *          listening for incoming connections.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger();

  // Creating an instance of the application by passing the root module (`JobBrokerModule`) to `NestFactory.create`.
  logger.debug("Initializing the app...");
  const app: INestApplication = await NestFactory.create(JobBrokerModule);

  // Apply the HttpExceptionFilter globally to handle all HTTP exceptions.
  logger.debug("Attaching the exception filter...");
  app.useGlobalFilters(new HttpExceptionFilter());

  const document: OpenAPIObject = (await NestiaSwaggerComposer.document(app, {
    // The OpenAPI specification version used for the generated documentation.
    openapi: "3.0",

    // Provides general information about the API including title, description, and version.
    info: {
      title: "OpenPRA Distributed Multi-Queue API",
      description: "PRA quantification and task execution message-broker",
      version: "0.0.1",
      license: {
        name: "MIT",
        identifier: "MIT",
      },
    },

    // Include the url where the app is being hosted
    servers: [],

    // Indicates whether the output JSON should be beautified.
    beautify: true,

    // decompose the query parameters into individual ones
    decompose: true,

    additional: true,
  })) as OpenAPIObject;

  logger.debug("Creating the API Documentation...");
  SwaggerModule.setup("/q/docs", app, document, {
    customSiteTitle: "OpenPRA-MQ API Docs",
    explorer: true,
    swaggerOptions: {},
  });

  // Increase the maximum request body limit to 50 MB.
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  // Start listening for incoming requests on port 3000.
  logger.debug("Microservices have been initialized.");
  await app.listen(3000);
}

// Executing the `bootstrap` function to start the application.
// The `void` operator is used here to explicitly indicate that the returned Promise is intentionally not handled.
void bootstrap();
