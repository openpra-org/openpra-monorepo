import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JobResponse } from "./job-broker.controller";
import { QuantificationJobReport } from "./middleware/schemas/quantification-job.schema";
import { ExecutableJobReport } from "./middleware/schemas/executable-job.schema";

@Injectable()
export class JobBrokerService {
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
  ) {}
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
  public async getJobs(status: string): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const quantifyJobs = await this.quantificationJobModel.find({ status: status }).lean();
    const executeTasks = await this.executableJobModel.find({ status: status }).lean();

    return {
      jobs: quantifyJobs,
      tasks: executeTasks,
    };
  }

  /**
   * Retrieves the list of pending jobs.
   *
   * @returns An object containing a message describing the pending jobs.
   */
  public async getPendingJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const pendingQuantifyJobs = await this.quantificationJobModel.find({ status: "pending" }).lean();
    const pendingExecuteTasks = await this.executableJobModel.find({ status: "pending" }).lean();

    return {
      jobs: pendingQuantifyJobs,
      tasks: pendingExecuteTasks,
    };
  }

  public async getRunningJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const runningQuantifyJobs = await this.quantificationJobModel.find({ status: "running" }).lean();
    const runningExecuteTasks = await this.executableJobModel.find({ status: "running" }).lean();

    return {
      jobs: runningQuantifyJobs,
      tasks: runningExecuteTasks,
    };
  }

  public async getCompletedJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const completedQuantifyJobs = await this.quantificationJobModel.find({ status: "completed" }).lean();
    const completedExecuteTasks = await this.executableJobModel.find({ status: "completed" }).lean();

    return {
      jobs: completedQuantifyJobs,
      tasks: completedExecuteTasks,
    };
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
