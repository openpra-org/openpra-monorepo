import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExecutableController } from "./executable.controller";
import { ExecutableService } from "./services/executable.service";
import { ExecutableWorkerService } from "./services/executable-worker.service";
import { ExecutableStorageService } from "./services/executable-storage.service";
import {
  ExecutedTask,
  ExecutedTaskSchema,
  ExecutedResult,
  ExecutedResultSchema,
} from "./schemas/executed-result.schema";

@Module({
  // Registering Mongoose schemas for executed tasks and results within the module.
  imports: [
    MongooseModule.forFeature([
      { name: ExecutedResult.name, schema: ExecutedResultSchema },
      { name: ExecutedTask.name, schema: ExecutedTaskSchema },
    ]),
  ],
  // Declaring the controller that exposes endpoints related to executable tasks.
  controllers: [ExecutableController],
  // Registering services that provide business logic for managing executable tasks and their storage.,
  providers: [ExecutableService, ExecutableWorkerService, ExecutableStorageService],
})
export class ExecutableModule {}
