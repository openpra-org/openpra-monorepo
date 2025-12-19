import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { RaptorManagerModule } from './raptor-manager.module';

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
 * This function initializes the NestJS application by creating an instance of the `RaptorManagerModule`
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

  // Creating an instance of the application by passing the root module (`RaptorManagerModule`) to `NestFactory.create`.
  logger.debug('Initializing the app...');
  const app: INestApplication = await NestFactory.create(RaptorManagerModule);

  // Apply the HttpExceptionFilter globally to handle all HTTP exceptions.
  logger.debug('Attaching the exception filter...');
  app.useGlobalFilters(new HttpExceptionFilter());

  // Determine server URL based on environment
  const hostUrl = process.env.HOST_URL || 'http://localhost:3000';
  const isProduction = process.env.NODE_ENV === 'production';

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RAPTOR API')
    .setDescription(
      'Risk Assessment Parallel Task ORchestrator: A distributed microservice for Probabilistic Risk Assessment (PRA) quantification primarily using SCRAM engine with RabbitMQ based job orchestration and MinIO object storage.',
    )
    .setVersion('1.0.3')
    .setLicense('MIT', 'https://opensource.org/license/mit/')
    .setContact('OpenPRA', 'https://github.com/ncsu-ne-prag', '')
    .addServer(isProduction ? hostUrl : 'http://localhost:3000')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  logger.debug('Creating the API Documentation...');
  SwaggerModule.setup('/q/docs', app, document, {
    customSiteTitle: 'RAPTOR API Documentation',
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Increase the maximum request body limit to 50 MB.
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Start listening for incoming requests on port 3000.
  logger.debug('Microservices have been initialized.');
  await app.listen(3000);
}

// Executing the `bootstrap` function to start the application.
// The `void` operator is used here to explicitly indicate that the returned Promise is intentionally not handled.
void bootstrap();
