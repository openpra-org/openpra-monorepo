import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class StorageService {
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  public async getQuantifiedReports(modelName: string): Promise<QuantificationJobReport[]> {
    console.log("Trying to find the metrics of the specified model");
    return this.quantificationJobModel.find({ model_name: modelName });
  }
}
