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
import { JobBrokerService } from "./job-broker.service";

export interface JobResponse {
  message: string;
}

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
  public getJobTypes(): JobResponse {
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
  public getPendingJobs(): JobResponse {
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
  public createJob(): JobResponse {
    try {
      return this.jobBrokerService.createJob();
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while creating a job.");
    }
  }
}
