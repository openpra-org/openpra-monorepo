import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JobBrokerMiddleware } from "../middleware/job-broker.middleware";
import {
  ExecuteJobBrokerSchema,
  ExecuteJobBrokerTask,
  QuantifyJobBrokerRequest,
  QuantifyJobBrokerSchema,
} from "../middleware/schemas/job-broker.schema";
import { ExecutableController } from "./executable.controller";
import { ExecutableService } from "./services/executable.service";
import { ExecutableWorkerService } from "./services/executable-worker.service";
import { ExecutableStorageService } from "./services/executable-storage.service";
import {
  ExecutedResult,
  ExecutedResultSchema,
  ExecutedTask,
  ExecutedTaskSchema,
} from "./schemas/executed-result.schema";

@Module({
  // Registering Mongoose schemas for executed tasks and results within the module.
  imports: [
    MongooseModule.forFeature([
      { name: ExecutedResult.name, schema: ExecutedResultSchema },
      { name: ExecutedTask.name, schema: ExecutedTaskSchema },
      { name: ExecuteJobBrokerTask.name, schema: ExecuteJobBrokerSchema },
      { name: QuantifyJobBrokerRequest.name, schema: QuantifyJobBrokerSchema },
    ]),
  ],
  // Declaring the controller that exposes endpoints related to executable tasks.
  controllers: [ExecutableController],
  // Registering services that provide business logic for managing executable tasks and their storage.,
  providers: [ExecutableService, ExecutableWorkerService, ExecutableStorageService],
})
export class ExecutableModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JobBrokerMiddleware).forRoutes(ExecutableController);
  }
}
