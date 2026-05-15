import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RaptorManagerService } from "./raptor-manager.service";
import { JobMetadata } from "./shared/minio.service";
import { readFileSync } from "fs";
import { join } from "path";
export interface JobTypesResponse {
  services: Array<{
    name: string;
    endpoint: string;
  }>;
}
export interface JobResponse {
  message: string;
}
@ApiTags("Job Management")
@Controller()
export class RaptorManagerController {
  constructor(private readonly raptorManagerService: RaptorManagerService) {}
  @Get("/job-types")
  public getJobTypes(): JobTypesResponse {
    try {
      return this.raptorManagerService.getJobTypes();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of job types.");
    }
  }
  @Get("/running-jobs")
  public async getRunningJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    try {
      return await this.raptorManagerService.getRunningJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of running jobs.");
    }
  }
  @Get("/completed-jobs")
  public async getCompletedJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    try {
      return await this.raptorManagerService.getCompletedJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of completed jobs.");
    }
  }
  @Get("/processing-jobs")
  public async getProcessingJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    try {
      return await this.raptorManagerService.getProcessingJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of processing jobs.");
    }
  }
  @Get("/partial-jobs")
  public async getPartialJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    try {
      return await this.raptorManagerService.getPartialJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of partial jobs.");
    }
  }
  @Get("/failed-jobs")
  public async getFailedJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    try {
      return await this.raptorManagerService.getFailedJobs();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of failed jobs.");
    }
  }
  @Get("/examples/:exampleId")
  public getExample(
    @Param("exampleId")
    exampleId: string,
  ): any {
    try {
      const fixturesPath = join(process.cwd(), "fixtures", "models", "MHTGR");
      let filePath: string;
      switch (exampleId) {
        case "1":
          filePath = join(fixturesPath, "JSON", "chinese.json");
          break;
        case "2":
          filePath = join(fixturesPath, "JSON", "demo_gas_leak.json");
          break;
        case "3":
          filePath = join(fixturesPath, "JSON", "chinese_adaptive.json");
          break;
        case "4":
          filePath = join(fixturesPath, "Adaptive", "demo_gas_leak.json");
          break;
        default:
          throw new NotFoundException(`Example ID must be 1, 2, 3, or 4. Received: ${exampleId}`);
      }
      const fileContent = readFileSync(filePath, "utf-8");
      const example = JSON.parse(fileContent);
      return example;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Unable to load example ${exampleId}: ${error.message}`);
    }
  }
}
