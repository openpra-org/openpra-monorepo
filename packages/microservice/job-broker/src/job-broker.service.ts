import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JobResponse } from "./job-broker.controller";
import { 
  QuantificationJobReport,
  ExecutableJobReport 
} from './schemas/job-reports.schema';

@Injectable()
export class JobBrokerService {
  constructor(
    @InjectModel(QuantificationJobReport.name)
    private quantificationJobReportModel: Model<QuantificationJobReport>,
    @InjectModel(ExecutableJobReport.name)
    private executableJobReportModel: Model<ExecutableJobReport>
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
    const quantifyJobs = await this.quantificationJobReportModel.find({ status: status }).lean();
    const executeTasks = await this.executableJobReportModel.find({ status: status }).lean();

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
    const pendingQuantifyJobs = await this.quantificationJobReportModel.find({ status: "pending" }).lean();
    const pendingExecuteTasks = await this.executableJobReportModel.find({ status: "pending" }).lean();

    return {
      jobs: pendingQuantifyJobs,
      tasks: pendingExecuteTasks,
    };
  }

  public async getQueuedJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const queuedQuantifyJobs = await this.quantificationJobReportModel.find({ status: "queued" }).lean();
    const queuedExecuteTasks = await this.executableJobReportModel.find({ status: "queued" }).lean();

    return {
      jobs: queuedQuantifyJobs,
      tasks: queuedExecuteTasks,
    };
  }

  public async getCompletedJobs(): Promise<{ jobs: QuantificationJobReport[]; tasks: ExecutableJobReport[] }> {
    const completedQuantifyJobs = await this.quantificationJobReportModel.find({ status: "completed" }).lean();
    const completedExecuteTasks = await this.executableJobReportModel.find({ status: "completed" }).lean();

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
