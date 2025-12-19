import fs from "fs";
import { Module } from "@nestjs/common";
import { APP_FILTER, RouterModule } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { HttpExceptionFilter } from "./http-exception.filter";
import { JobBrokerController } from "./job-broker.controller";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationModule } from "./quantification/quantification.module";
import { ValidationModule } from "./validation/validation.module";
import { ExecutableModule } from "./executable/executable.module";
import { QuantificationJobReport, QuantificationJobSchema } from "./middleware/schemas/quantification-job.schema";
import { ExecutableJobReport, ExecutableJobSchema } from "./middleware/schemas/executable-job.schema";

/**
 * Root module wiring quantification and executable submodules under the `/q` API path.
 */
@Module({
  // Define the modules to import, including configuration, database connection, and submodules.
  imports: [
    QuantificationModule,
    ValidationModule,
    ExecutableModule,
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
      cache: true,
      ignoreEnvFile: !fs.existsSync(".env"),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGO_URL"),
      }),
    }),
    MongooseModule.forFeature([
      { name: QuantificationJobReport.name, schema: QuantificationJobSchema },
      { name: ExecutableJobReport.name, schema: ExecutableJobSchema },
    ]),
    RouterModule.register([
      {
        path: "q", // Define the base path for the API.
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
