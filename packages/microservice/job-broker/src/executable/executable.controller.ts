import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post } from "@nestjs/common";
import type { ExecutionTask } from "mef-types/openpra-mef/util/execution-task";
import { ExecutableJobReport } from "../middleware/schemas/executable-job.schema";
import { ExecutableService } from "./services/executable.service";
import { ExecutableStorageService } from "./services/executable-storage.service";

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
  @Post("/tasks")
  public async createAndQueueTask(@Body() taskRequest: ExecutionTask): Promise<void> {
    try {
      await this.executableService.createAndQueueTask(taskRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing a binary executable task.");
    }
  }

  /**
   * Endpoint to retrieve a list of executed tasks and their results.
   *
   * @returns A promise that resolves to an array of {@link ExecutableJobReport}, each representing an executed task.
   * @throws {@link NotFoundException} When the executed tasks cannot be found or retrieved.
   */
  @Get("/tasks")
  public async getExecutedTasks(): Promise<ExecutableJobReport[]> {
    try {
      return this.executableStorageService.getExecutedTasks();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of executed tasks.");
    }
  }
}
