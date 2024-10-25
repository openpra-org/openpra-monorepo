/**
 * Defines the Quantification module for the application.
 *
 * This module is responsible for handling all quantification-related operations, including
 * managing quantified reports and providing endpoints for SCRAM and FTREX functionalities.
 * It integrates MongoDB for data persistence using Mongoose and defines the necessary
 * controllers and services for quantification processes.
 */

// // Importing NestJS common and Mongoose modules, controllers for SCRAM and FTREX, services
// for business logic, and schema for quantified reports.
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EnvVarKeys } from "../../config/env_vars.config";
import { ConsumerService } from "./services/consumer.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".development.env", // Specify the environment file path.
      isGlobal: true, // Make configuration globally available.
      cache: true, // Enable caching of environment variables.
      ignoreEnvFile: !!process.env.DEPLOYMENT, // Conditionally ignore the environment file based on deployment status.
    }),
  ],
  // Register services to provide business logic for quantification operations.
  providers: [ConsumerService],
})
export class QuantificationConsumerModule {}
