import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableService } from "./services/executable.service";
import { ExecutableStorageService } from "./services/executable-storage.service";
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
  @TypedRoute.Post("/tasks")
  public createAndQueueTask(@TypedBody() taskRequest: ExecutionTask): void {
    try {
      this.executableService.createAndQueueTask(taskRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing a binary executable task.");
    }
  }

  /**
   * Endpoint to retrieve a list of executed tasks and their results.
   *
   * @returns A promise that resolves to an array of {@link ExecutedResult}, each representing an executed task.
   * @throws {@link NotFoundException} When the executed tasks cannot be found or retrieved.
   */
  @TypedRoute.Get("/tasks")
  public async getExecutedTasks(): Promise<ExecutedResult[]> {
    try {
      return this.executableStorageService.getExecutedTasks();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of executed tasks.");
    }
  }
}
