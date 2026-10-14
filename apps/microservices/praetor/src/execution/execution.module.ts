import { Module } from "@nestjs/common";
import { QueueModule } from "../shared";
import { ExecuteController } from "./controllers/execute.controller";
import { ExecuteProducerService } from "./services/execute-producer.service";
import { ExecuteStorageService } from "./services/execute-storage.service";
import { PraxisJobsService } from "./services/praxis-jobs.service";
import { PraxisJobStore } from "./praxis-job-store";

@Module({
  imports: [QueueModule],
  controllers: [ExecuteController],
  providers: [ExecuteProducerService, ExecuteStorageService, PraxisJobsService, PraxisJobStore],
})
export class ExecutionModule {}
