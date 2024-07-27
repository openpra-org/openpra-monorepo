import { Injectable } from "@nestjs/common";

@Injectable()
export class JobBrokerService {
  getJobTypes(): { message: string } {
    return { message: "return the types of jobs" };
  }
  getPendingJobs(): { message: string } {
    return { message: "return the pending jobs" };
  }
  createJob(): { message: string } {
    return { message: "create a new job" };
  }
}
