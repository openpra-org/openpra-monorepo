import { execSync } from "node:child_process";
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

  public runSerializedExperiment(num_runs: string): void {
    const COMMAND =
      "scram-cli --mocus --mcub --probability --uncertainty --num-trials 1000 --o ./output.xml ./fixtures/models/generic-openpsa-models/models/Aralia/baobab3.xml";

    try {
      console.log("Starting benchmark...");
      const startTime = Date.now();

      for (let i = 0; i < Number(num_runs); i++) {
        execSync(COMMAND, { stdio: "inherit" });
      }

      const totalTime = (Date.now() - startTime) / 1000; // Convert to seconds
      console.log(`\nTotal time for ${num_runs} runs: ${totalTime.toFixed(2)} seconds`);
    } catch (error) {
      console.error("Error during benchmark:", error);
      process.exit(1);
    }
  }
}
