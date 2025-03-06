import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

@Injectable()
export class ExecutableStorageService {
  constructor(@InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>) {}

  /**
   * Retrieves all executed tasks from the database.
   *
   * @returns A promise that resolves to an array of executed results.
   */
  async getExecutedTasks(): Promise<ExecutableJobReport[]> {
    return this.executableJobModel.find();
  }
}
