import { Controller } from "@nestjs/common";
import { TypedRoute, TypedBody } from "@nestia/core";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutableService } from "./executable.service";

@Controller()
export class ExecutableController {
  constructor(private readonly executableService: ExecutableService) {}

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
}
