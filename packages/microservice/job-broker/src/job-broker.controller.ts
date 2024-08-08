import { Controller, Get, InternalServerErrorException, NotFoundException, Post, UseFilters } from "@nestjs/common";
import { JobBrokerService } from "./job-broker.service";
import { HttpExceptionFilter } from "./exception-filters/http-exception.filter";

@Controller("/job-broker")
@UseFilters(new HttpExceptionFilter())
export class JobBrokerController {
  constructor(private readonly jobBrokerService: JobBrokerService) {}
  @Get("/job-types")
  getJobTypes(): { message: string } {
    try {
      return this.jobBrokerService.getJobTypes();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of job types.");
    }
  }
  @Get("/pending-jobs")
  getPendingJobs(): { message: string } {
    try {
      return this.jobBrokerService.getPendingJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of pending jobs.");
    }
  }
  @Post("/create-job")
  createJob(): { message: string } {
    try {
      return this.jobBrokerService.createJob();
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while creating a job.");
    }
  }
}
