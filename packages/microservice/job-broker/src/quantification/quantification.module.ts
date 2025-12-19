import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JobBrokerMiddleware } from "../middleware/job-broker.middleware";
import { QuantificationJobReport, QuantificationJobSchema } from "../middleware/schemas/quantification-job.schema";
import { ExecutableJobReport, ExecutableJobSchema } from "../middleware/schemas/executable-job.schema";
import { ScramController } from "./controllers/scram.controller";
import { FtrexController } from "./controllers/ftrex.controller";
import { ProducerService } from "./services/producer.service";
import { StorageService } from "./services/storage.service";

/**
 * Nest module that exposes quantification endpoints and wiring for producer/storage services.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuantificationJobReport.name, schema: QuantificationJobSchema },
      { name: ExecutableJobReport.name, schema: ExecutableJobSchema },
    ]),
  ],
  controllers: [ScramController, FtrexController],
  providers: [ProducerService, StorageService],
})
export class QuantificationModule implements NestModule {
  /**
   * Configure middleware for quantification routes.
   * @param consumer - Nest middleware consumer to bind middleware to routes
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JobBrokerMiddleware).forRoutes(ScramController);
    consumer.apply(JobBrokerMiddleware).forRoutes(FtrexController);
  }
}
