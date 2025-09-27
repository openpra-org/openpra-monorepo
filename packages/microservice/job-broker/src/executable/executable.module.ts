import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QueueModule } from "../shared";
import { JobBrokerMiddleware } from "../middleware/job-broker.middleware";
import { ExecutableJobReport, ExecutableJobSchema } from "../middleware/schemas/executable-job.schema";
import { QuantificationJobReport, QuantificationJobSchema } from "../middleware/schemas/quantification-job.schema";
import { ExecutableController } from "./executable.controller";
import { ExecutableService } from "./services/executable.service";
import { ExecutableStorageService } from "./services/executable-storage.service";

@Module({
  imports: [
    QueueModule,
    MongooseModule.forFeature([
      { name: ExecutableJobReport.name, schema: ExecutableJobSchema },
      { name: QuantificationJobReport.name, schema: QuantificationJobSchema },
    ]),
  ],
  controllers: [ExecutableController],
  providers: [ExecutableService, ExecutableStorageService],
})
export class ExecutableModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JobBrokerMiddleware).forRoutes(ExecutableController);
  }
}
