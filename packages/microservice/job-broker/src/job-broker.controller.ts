/**
 * Controller for handling job broker related requests.
 *
 * This controller provides endpoints for retrieving job types, pending jobs,
 * and creating a new job. It uses the `JobBrokerService` for business logic
 * and data retrieval.
 */

// Import necessary decorators and services from NestJS and custom modules.
import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute } from "@nestia/core";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JobBrokerService } from "./job-broker.service";

@ApiTags("jobs")
@Controller()
export class JobBrokerController {
  /**
   * Constructs the JobBrokerController with the necessary service.
   * @param jobBrokerService - The service to handle job broker operations.
   */
  constructor(private readonly jobBrokerService: JobBrokerService) {}

  /**
   * Retrieves a list of job types.
   *
   * @returns An object containing a message with the list of job types.
   * @throws {@link NotFoundException} When the list of job types cannot be found.
   */
  @TypedRoute.Get("/job-types")
  @ApiOperation({ summary: "Get job types" })
  @ApiOkResponse({ description: "Returns the type of the jobs" })
  @ApiNotFoundResponse({ status: 404, description: "Job types not found" })
  public getJobTypes(): { message: string } {
    try {
      return this.jobBrokerService.getJobTypes();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of job types.");
    }
  }

  /**
   * Retrieves a list of pending jobs.
   *
   * @returns An object containing a message with the list of pending jobs.
   * @throws {@link NotFoundException} When the list of pending jobs cannot be found.
   */
  @TypedRoute.Get("/pending-jobs")
  @ApiOperation({ summary: "Get pending jobs" })
  @ApiOkResponse({ description: "Returns the pending jobs" })
  @ApiNotFoundResponse({ status: 404, description: "Pending jobs not found" })
  public getPendingJobs(): { message: string } {
    try {
      return this.jobBrokerService.getPendingJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of pending jobs.");
    }
  }

  /**
   * Creates a new job.
   *
   * @returns An object containing a message confirming the job creation.
   * @throws {@link InternalServerErrorException} When there is a problem creating the job.
   */
  @TypedRoute.Post("/create-job")
  @ApiOperation({ summary: "Create a new job" })
  @ApiCreatedResponse({ description: "The job has been successfully created" })
  @ApiInternalServerErrorResponse({ status: 500, description: "Job cannot be created due to internal server error" })
  @ApiBody({ schema: {} })
  public createJob(): { message: string } {
    try {
      return this.jobBrokerService.createJob();
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while creating a job.");
    }
  }
}
