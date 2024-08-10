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
  imports: [
    MongooseModule.forFeature([
      { name: ExecutedResult.name, schema: ExecutedResultSchema },
      { name: ExecutedTask.name, schema: ExecutedTaskSchema },
    ]),
  ],
  controllers: [ExecutableController],
  providers: [ExecutableService, ExecutableWorkerService, ExecutableStorageService],
})
export class ExecutableModule {}
