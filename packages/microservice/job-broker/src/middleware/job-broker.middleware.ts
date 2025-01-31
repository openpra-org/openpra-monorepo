import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { QuantificationJobReport } from "./schemas/quantification-job.schema";
import { ExecutableJobReport } from "./schemas/executable-job.schema";

@Injectable()
export class JobBrokerMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
  ) {}

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
  private isQuantifyRequest(body: any): body is QuantifyRequest {
    return body && Array.isArray(body.models) && body.models.every((item: any) => typeof item === "string");
  }

  private isExecutionTask(body: any): body is ExecutionTask {
    const executables = ["scram-cli", "saphsolve", "ftrex", "xfta", "xfta2", "dpc", "acube", "qrecover"];
    return body && typeof body.executable === "string" && executables.includes(body.executable);
  }
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    console.log("Checking whether it is a quantification or executable request");
    if (this.isQuantifyRequest(req.body)) {
      const startTime = performance.now();
      const quantificationJob = await this.quantificationJobModel.create({ configuration: req.body.configuration });
      const jobId = quantificationJob._id.toString();
      req.body._id = jobId;
      const endTime = performance.now();

      await this.quantificationJobModel.findByIdAndUpdate(jobId, {
        $set: { "execution_time.mongodb_crud": endTime - startTime },
      });
    } else if (this.isExecutionTask(req.body)) {
      const executableJob = await this.executableJobModel.create({ task: req.body });
      req.body._id = executableJob._id.toString();
    }

    next();
  }
}
