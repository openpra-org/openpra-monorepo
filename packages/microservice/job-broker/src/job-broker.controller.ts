import { Controller, Get, Post } from "@nestjs/common";
import { JobBrokerService } from "./job-broker.service";

@Controller("/job-broker")
export class JobBrokerController {
  constructor(private readonly jobBrokerService: JobBrokerService) {}
  @Get("/job-types")
  getJobTypes(): { message: string } {
    return this.jobBrokerService.getJobTypes();
  }
  @Get("/pending-jobs")
  getPendingJobs(): { message: string } {
    return this.jobBrokerService.getPendingJobs();
  }
  @Post("/create-job")
  createJob(): { message: string } {
    return this.jobBrokerService.createJob();
  }
}
