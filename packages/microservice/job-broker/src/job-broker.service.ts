/**
 * Service responsible for handling job broker operations.
 *
 * Provides functionality to retrieve job types, pending jobs, and to create new jobs.
 * This service acts as a layer between the controller and the database,
 * encapsulating the business logic of the job broker.
 */

// Import the Injectable decorator from NestJS to mark the class as a service that can be injected.
import { Injectable } from "@nestjs/common";

@Injectable()
export class JobBrokerService {
  /**
   * Retrieves the types of jobs available.
   *
   * @returns An object containing a message describing the types of jobs.
   */
  public getJobTypes(): { message: string } {
    return { message: "return the types of jobs" };
  }

  /**
   * Retrieves the list of pending jobs.
   *
   * @returns An object containing a message describing the pending jobs.
   */
  public getPendingJobs(): { message: string } {
    return { message: "return the pending jobs" };
  }

  /**
   * Creates a new job.
   *
   * @returns An object containing a message confirming the creation of a new job.
   */
  public createJob(): { message: string } {
    return { message: "create a new job" };
  }
}
