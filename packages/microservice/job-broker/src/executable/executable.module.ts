import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JobBrokerMiddleware } from "../middleware/job-broker.middleware";
import { ExecutableJobReport, ExecutableJobSchema } from "../middleware/schemas/executable-job.schema";
import { QuantificationJobReport, QuantificationJobSchema } from "../middleware/schemas/quantification-job.schema";
import { ExecutableController } from "./executable.controller";
import { ExecutableService } from "./services/executable.service";
import { ExecutableWorkerService } from "./services/executable-worker.service";
import { ExecutableStorageService } from "./services/executable-storage.service";

/**
 * Nest module that exposes executable task endpoints and workers.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutableJobReport.name, schema: ExecutableJobSchema },
      { name: QuantificationJobReport.name, schema: QuantificationJobSchema },
    ]),
  ],
  controllers: [ExecutableController],
  providers: [ExecutableService, ExecutableWorkerService, ExecutableStorageService],
})
export class ExecutableModule implements NestModule {
  /**
   * Configure middleware for executable task routes.
   * @param consumer - Nest middleware consumer to bind middleware to routes
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JobBrokerMiddleware).forRoutes(ExecutableController);
  }
}
