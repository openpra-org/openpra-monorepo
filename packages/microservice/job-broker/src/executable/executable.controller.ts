import { Controller } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableService } from "./executable.service";
import { ExecutedResult } from "./schemas/executed-result.schema";
import { ExecutableStorageService } from "./executable-storage.service";

@Controller()
export class ExecutableController {
  constructor(
    private readonly executableService: ExecutableService,
    private readonly executableStorageService: ExecutableStorageService,
  ) {}

  @TypedRoute.Post("/create-task")
  public async createAndQueueTask(@TypedBody() taskRequest: ExecutionTask): Promise<boolean> {
    return this.executableService.createAndQueueTask(taskRequest);
  }

  @TypedRoute.Get("/get-executed-tasks")
  public async getExecutedTasks(): Promise<ExecutedResult[]> {
    return this.executableStorageService.getExecutedTasks();
  }
}
