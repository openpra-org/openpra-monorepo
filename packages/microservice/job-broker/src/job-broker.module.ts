/**
 * Defines the Job Broker module for the application.
 *
 * This module integrates various submodules, configurations, and services necessary for the Job Broker application,
 * including the connection to MongoDB via Mongoose, environment configuration, and routing for different endpoint
 * prefixes such as quantification, validation, and executable tasks. It also sets up global exception handling.
 */

// Import necessary modules, services, and controllers from NestJS, Mongoose, and local files.
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, RouterModule } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./http-exception.filter";
import { JobBrokerController } from "./job-broker.controller";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { ValidationModule } from "./validation/validation.module";
import { ExecutableModule } from "./executable/executable.module";

@Module({
  // Define the modules to import, including configuration, database connection, and submodules.
  imports: [
    ExecutableModule,
    QuantificationModule,
    ValidationModule,
    ConfigModule.forRoot({
      envFilePath: ".development.env", // Specify the environment file path.
      isGlobal: true, // Make configuration globally available.
      cache: true, // Enable caching of environment variables.
      ignoreEnvFile: !!process.env.DEPLOYMENT, // Conditionally ignore the environment file based on deployment status.
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // Import ConfigModule for database configuration.
      inject: [ConfigService], // Inject ConfigService to use the preset env variable for the database URI.
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGO_URL"), // Get the MongoDB URL variable from the env file.
      }),
    }),
    RouterModule.register([
      {
        path: "api", // Define the base path for the API.
        module: JobBrokerModule,
        children: [
          // Define child modules for specific endpoint prefixes.
          {
            path: "quantification",
            module: QuantificationModule,
          },
          {
            path: "validation",
            module: ValidationModule,
          },
          {
            path: "executable",
            module: ExecutableModule,
          },
        ],
      },
    ]),
    SwaggerModule,
  ],
  controllers: [JobBrokerController], // Register the controller for this module.
  providers: [
    JobBrokerService, // Register the service for dependency injection.
    {
      provide: APP_FILTER, // Register the global exception filter.
      useClass: HttpExceptionFilter,
    },
  ],
})
export class JobBrokerModule {}
