import { Controller } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableService } from "./executable.service";
import { ExecutableStorageService } from "./executable-storage.service";
import { ExecutedResult } from "./schemas/executed-result.schema";

@Controller()
export class ExecutableController {
  constructor(
    private readonly executableService: ExecutableService,
    private readonly executableStorageService: ExecutableStorageService,
  ) {}

  /**
   * Create a new execution task.
   *
   * @returns Boolean representing whether task was queued.
   * @param taskRequest - The task to execute.
   */
  @TypedRoute.Post()
  public async createTask(@TypedBody() taskRequest: ExecutionTask): Promise<boolean> {
    return this.executableService.createAndQueueTask(taskRequest);
  }

  /**
   * Endpoint to retrieve a list of executed tasks and their results.
   *
   * @returns A promise that resolves to an array of {@link ExecutedResult}, each representing an executed task.
   * @throws {@link NotFoundException} When the executed tasks cannot be found or retrieved.
   */
  @TypedRoute.Get("/get-executed-tasks")
  public async getExecutedTasks(): Promise<ExecutedResult[]> {
    return this.executableStorageService.getExecutedTasks();
  }
}
