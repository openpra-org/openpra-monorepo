import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JobResponse } from "./job-broker.controller";
import { ExecuteJobBrokerTask, QuantifyJobBrokerRequest } from "./middleware/schemas/job-broker.schema";

@Injectable()
export class JobBrokerService {
  constructor(
    @InjectModel(QuantifyJobBrokerRequest.name)
    private readonly quantifyJobBrokerModel: Model<QuantifyJobBrokerRequest>,
    @InjectModel(ExecuteJobBrokerTask.name) private readonly executeJobBrokerModel: Model<ExecuteJobBrokerTask>,
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
  public async getPendingJobs(): Promise<{ jobs: QuantifyJobBrokerRequest[]; tasks: ExecuteJobBrokerTask[] }> {
    const pendingQuantifyJobs = await this.quantifyJobBrokerModel.find().lean();
    const pendingExecuteTasks = await this.executeJobBrokerModel.find().lean();

    return {
      jobs: pendingQuantifyJobs,
      tasks: pendingExecuteTasks,
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
