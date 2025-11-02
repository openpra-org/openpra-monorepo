import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

/**
 * Reads quantified report documents from MongoDB.
 */
@Injectable()
export class StorageService {
  /**
   * Construct the service with the quantification job model.
   * @param quantificationJobModel - Mongoose model for reading quantified job reports
   */
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  public async getQuantifiedReports(): Promise<QuantificationJobReport[]> {
    return this.quantificationJobModel.find();
  }
}
