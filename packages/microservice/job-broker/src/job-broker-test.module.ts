import { Module } from "@nestjs/common";
import { APP_FILTER, RouterModule } from "@nestjs/core";
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
    RouterModule.register([
      {
        path: "api", // Define the base path for the API.
        module: JobBrokerTestModule,
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
export class JobBrokerTestModule {}
