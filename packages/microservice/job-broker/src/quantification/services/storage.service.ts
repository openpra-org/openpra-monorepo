import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class StorageService {
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  public async getQuantifiedReports(modelName: string): Promise<number> {
    const reports = await this.quantificationJobModel.find({ model_name: modelName });
    if (!reports || reports.length === 0) {
      throw new Error("No reports found");
    }

    const startTimes = reports.map((r) => Number(r.execution_time!.experimentStartTime));
    const endTimes = reports.map((r) => Number(r.execution_time!.experimentEndTime));
    const minStart = Math.min(...startTimes);
    const maxEnd = Math.max(...endTimes);

    return maxEnd - minStart;
  }
}
