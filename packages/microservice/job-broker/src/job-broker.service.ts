import { Injectable } from "@nestjs/common";

@Injectable()
export class JobBrokerService {
  public getJobTypes(): { message: string } {
    return { message: "return the types of jobs" };
  }

  public getPendingJobs(): { message: string } {
    return { message: "return the pending jobs" };
  }

  public createJob(): { message: string } {
    return { message: "create a new job" };
  }
}
