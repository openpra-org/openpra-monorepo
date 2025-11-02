import { Controller, Query, InternalServerErrorException, NotFoundException, Get, Post } from "@nestjs/common";
import { JobBrokerService } from "./job-broker.service";
import { QuantificationJobReport } from "./middleware/schemas/quantification-job.schema";
import { ExecutableJobReport } from "./middleware/schemas/executable-job.schema";

/** Minimal response shape returned by job broker endpoints. */
export interface JobResponse {
  message: string;
}

@Controller()
/**
 * HTTP controller for job broker endpoints.
 *
 * Provides routes to list job types and to query jobs by lifecycle status
 * (pending, queued, completed) across quantification and executable tasks.
 */
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
   * @throws `NotFoundException` When the list of job types cannot be found.
   */
  @Get("/job-types")
  public getJobTypes(): JobResponse {
    try {
      return this.jobBrokerService.getJobTypes();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of job types.");
    }
  }

  /**
   * Retrieves a list of jobs based on the status.
   *
   * @param status - Lifecycle status to filter jobs by (e.g., "pending", "queued", "completed")
   * @returns An object containing a message with the list of pending jobs.
   * @throws `NotFoundException` When the list of pending jobs cannot be found.
   */
  @Get("/jobs")
  public async getJobs(
    @Query("status") status: string,
  ): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    try {
      return this.jobBrokerService.getJobs(status);
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of pending jobs.");
    }
  }

  /**
   * Retrieves a list of pending jobs.
   *
   * @returns An object containing a message with the list of pending jobs.
   * @throws `NotFoundException` When the list of pending jobs cannot be found.
   */
  @Get("/pending-jobs")
  public async getPendingJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    try {
      return this.jobBrokerService.getPendingJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of pending jobs.");
    }
  }

  @Get("/queued-jobs")
  public async getQueuedJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    try {
      return this.jobBrokerService.getQueuedJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of queued jobs.");
    }
  }

  @Get("/completed-jobs")
  public async getCompletedJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    try {
      return this.jobBrokerService.getCompletedJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of completed jobs.");
    }
  }

  /**
   * Creates a new job.
   *
   * @returns An object containing a message confirming the job creation.
   * @throws `InternalServerErrorException` When there is a problem creating the job.
   */
  @Post("/create-job")
  public createJob(): JobResponse {
    try {
      return this.jobBrokerService.createJob();
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while creating a job.");
    }
  }
}
