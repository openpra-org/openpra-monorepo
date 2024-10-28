import { Injectable } from "@nestjs/common";
import { JobResponse } from "./job-broker.controller";

@Injectable()
export class JobBrokerService {
  /**
   * Retrieves the types of jobs available.
   *
   * @returns An object containing a message describing the types of jobs.
   */
  public getJobTypes(): JobResponse {
    return { message: "return the types of jobs" };
  }

  /**
   * Retrieves the list of pending jobs.
   *
   * @returns An object containing a message describing the pending jobs.
   */
  public getPendingJobs(): JobResponse {
    return { message: "return the pending jobs" };
  }

  /**
   * Creates a new job.
   *
   * @returns An object containing a message confirming the creation of a new job.
   */
  public createJob(): JobResponse {
    return { message: "create a new job" };
  }
}
