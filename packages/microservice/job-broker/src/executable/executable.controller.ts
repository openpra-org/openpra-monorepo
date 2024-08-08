import { Controller, InternalServerErrorException, NotFoundException, UseFilters } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { HttpExceptionFilter } from "../exception-filters/http-exception.filter";
import { ExecutableService } from "./services/executable.service";
import { ExecutableStorageService } from "./services/executable-storage.service";
import { ExecutedResult } from "./schemas/executed-result.schema";

@Controller()
@UseFilters(new HttpExceptionFilter())
export class ExecutableController {
  constructor(
    private readonly executableService: ExecutableService,
    private readonly executableStorageService: ExecutableStorageService,
  ) {}

  @TypedRoute.Post("/create-task")
  public async createAndQueueTask(@TypedBody() taskRequest: ExecutionTask): Promise<boolean> {
    try {
      return this.executableService.createAndQueueTask(taskRequest);
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing a binary executable task.");
    }
  }

  @TypedRoute.Get("/get-executed-tasks")
  public async getExecutedTasks(): Promise<ExecutedResult[]> {
    try {
      return this.executableStorageService.getExecutedTasks();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of executed tasks.");
    }
  }
}
