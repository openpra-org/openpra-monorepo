import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, RouterModule } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { EnvVarKeys } from "../config/env_vars.config";
import { HttpExceptionFilter } from "./http-exception.filter";
import { JobBrokerController } from "./job-broker.controller";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { ValidationModule } from "./validation/validation.module";
import { ExecutableModule } from "./executable/executable.module";

@Module({
  // Define the modules to import, including configuration, database connection, and submodules.
  imports: [
    QuantificationModule,
    ValidationModule,
    ExecutableModule,
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
        uri: config.getOrThrow(EnvVarKeys.MONGODB_URI),
      }),
    }),
    RouterModule.register([
      {
        path: "api", // Define the base path for the API.
        module: JobBrokerModule,
        children: [
          // Define child modules for specific endpoint prefixes.
          {
            path: "quantify",
            module: QuantificationModule,
          },
          {
            path: "validate",
            module: ValidationModule,
          },
          {
            path: "execute",
            module: ExecutableModule,
          },
        ],
      },
    ]),
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
