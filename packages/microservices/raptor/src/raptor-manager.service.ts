import { Injectable } from "@nestjs/common";
import { JobResponse } from "./raptor-manager.controller";
import { StorageService } from "./quantification/services/storage.service";
import { JobMetadata } from "./shared/minio.service";
@Injectable()
export class RaptorManagerService {
  constructor(private readonly storageService: StorageService) {}
  public getJobTypes(): {
    services: Array<{
      name: string;
      endpoint: string;
    }>;
  } {
    return {
      services: [
        { name: "SCRAM Quantify", endpoint: "/q/scram/quantify" },
        { name: "SCRAM Execute", endpoint: "/q/scram/execute" },
        { name: "SaphSolve Quantify", endpoint: "/q/saphsolve/quantify" },
        { name: "SaphSolve Execute", endpoint: "/q/saphsolve/execute" },
        { name: "XFTA Quantify", endpoint: "/q/xfta/quantify" },
        { name: "XFTA Execute", endpoint: "/q/xfta/execute" },
        { name: "FTREX Quantify", endpoint: "/q/ftrex/quantify" },
        { name: "FTREX Execute", endpoint: "/q/ftrex/execute" },
        { name: "Input Validation", endpoint: "/validate/input" },
        { name: "Format Conversion", endpoint: "/convert/format" },
        { name: "Synthetic Model Generator", endpoint: "/generate/synthetic" },
        {
          name: "Fault Tree from P&ID and PFD",
          endpoint: "/generate/fault-tree/pid_pfd",
        },
      ],
    };
  }
  public async getRunningJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    const allJobs = await this.storageService.getQuantifiedReports();
    const filteredJobs = allJobs.filter((job) => job.status === "running");
    return {
      jobs: filteredJobs,
    };
  }
  public async getCompletedJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    const allJobs = await this.storageService.getQuantifiedReports();
    const filteredJobs = allJobs.filter((job) => job.status === "completed");
    return {
      jobs: filteredJobs,
    };
  }
  public async getProcessingJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    const allJobs = await this.storageService.getQuantifiedReports();
    const filteredJobs = allJobs.filter((job) => job.status === "processing");
    return {
      jobs: filteredJobs,
    };
  }
  public async getPartialJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    const allJobs = await this.storageService.getQuantifiedReports();
    const filteredJobs = allJobs.filter((job) => job.status === "partial");
    return {
      jobs: filteredJobs,
    };
  }
  public async getFailedJobs(): Promise<{
    jobs: JobMetadata[];
  }> {
    const allJobs = await this.storageService.getQuantifiedReports();
    const filteredJobs = allJobs.filter((job) => job.status === "failed");
    return {
      jobs: filteredJobs,
    };
  }
  public createJob(): JobResponse {
    return { message: "create a new job" };
  }
}
