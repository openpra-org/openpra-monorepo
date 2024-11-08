import { NestFactory } from "@nestjs/core";
import { NestiaSwaggerComposer } from "@nestia/sdk";
import { OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { JobBrokerModule } from "./job-broker.module";

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
  // Creating an instance of the application by passing the root module (`JobBrokerModule`) to `NestFactory.create`.
  const app: INestApplication = await NestFactory.create(JobBrokerModule);

  // Apply the HttpExceptionFilter globally to handle all HTTP exceptions.
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

  SwaggerModule.setup("/api/docs", app, document, {
    customSiteTitle: "OpenPRA-MQ API Docs",
    explorer: true,
    swaggerOptions: {},
  });

  // Start listening for incoming requests on port 3000.
  await app.listen(3_000);
}

// Executing the `bootstrap` function to start the application.
// The `void` operator is used here to explicitly indicate that the returned Promise is intentionally not handled.
void bootstrap();
