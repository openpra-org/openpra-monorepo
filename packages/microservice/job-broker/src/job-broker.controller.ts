import { Controller, InternalServerErrorException, NotFoundException, UseFilters } from "@nestjs/common";
import { TypedRoute } from "@nestia/core";
import { JobBrokerService } from "./job-broker.service";
import { HttpExceptionFilter } from "./exception-filters/http-exception.filter";

@Controller()
@UseFilters(new HttpExceptionFilter())
export class JobBrokerController {
  constructor(private readonly jobBrokerService: JobBrokerService) {}

  @TypedRoute.Get("/job-types")
  public getJobTypes(): { message: string } {
    try {
      return this.jobBrokerService.getJobTypes();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of job types.");
    }
  }

  @TypedRoute.Get("/pending-jobs")
  public getPendingJobs(): { message: string } {
    try {
      return this.jobBrokerService.getPendingJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of pending jobs.");
    }
  }

  @TypedRoute.Post("/create-job")
  public createJob(): { message: string } {
    try {
      return this.jobBrokerService.createJob();
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while creating a job.");
    }
  }
}
