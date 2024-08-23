/**
 * Controller for executable task related endpoints.
 *
 * Provides endpoints for creating new executable tasks and retrieving the list of executed tasks.
 * Utilizes services for task creation, queueing, and retrieval of execution results.
 */

// Importing core NestJS functionalities along with typed route handling from Nestia,
// shared types for execution task structure and services for task management and storage, and
// schemas for executed results to define the return type of one of the endpoints.
import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ApiBody, ApiCreatedResponse, ApiInternalServerErrorResponse, ApiOperation } from "@nestjs/swagger";
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
   * Endpoint to create and queue a new executable task based on the provided request.
   *
   * @param taskRequest - The executable task request containing binary executable name, arguments,
   * and env variables necessary for task execution.
   * @returns A promise that resolves to void, indicating successful task creation and queueing.
   * @throws {@link InternalServerErrorException} When there is a problem queueing the executable task.
   */
  @TypedRoute.Post("/create-task")
  @ApiOperation({ summary: "Create a new job" })
  @ApiCreatedResponse({ description: "The job has been successfully created" })
  @ApiInternalServerErrorResponse({ status: 500, description: "Job cannot be created due to internal server error" })
  @ApiBody({ schema: {} })
  public async createAndQueueTask(@TypedBody() taskRequest: ExecutionTask): Promise<void> {
    try {
      return this.executableService.createAndQueueTask(taskRequest);
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
  @TypedRoute.Get("/get-executed-tasks")
  public async getExecutedTasks(): Promise<ExecutedResult[]> {
    try {
      return this.executableStorageService.getExecutedTasks();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of executed tasks.");
    }
  }
}
