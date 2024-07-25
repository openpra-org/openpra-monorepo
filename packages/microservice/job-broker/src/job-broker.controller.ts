import { Controller, Get, Post } from "@nestjs/common";
import { JobBrokerService } from "./job-broker.service";

@Controller()
export class JobBrokerController {
  constructor(private readonly jobBrokerService: JobBrokerService) {}
  @Get()
  getJobTypes() {
    return this.jobBrokerService.getJobTypes();
  }
  @Get()
  getPendingJobs() {
    return this.jobBrokerService.getPendingJobs();
  }
  @Post()
  createJob() {
    return this.jobBrokerService.createJob();
  }
}
