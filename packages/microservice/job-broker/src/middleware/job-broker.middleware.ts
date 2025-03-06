import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { QuantificationJobReport } from "./schemas/quantification-job.schema";
import { ExecutableJobReport } from "./schemas/executable-job.schema";

@Injectable()
export class JobBrokerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JobBrokerMiddleware.name);

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
    if (this.isQuantifyRequest(req.body)) {
      this.logger.debug("Storing the quantification request...");
      const quantificationJob = await this.quantificationJobModel.create({ configuration: req.body });
      const jobId = quantificationJob._id.toString();
      this.logger.debug(`${jobId} has been stored.`);
      req.body._id = jobId;
    } else if (this.isExecutionTask(req.body)) {
      this.logger.debug("Storing the executable task...");
      const executableTask = await this.executableJobModel.create({ task: req.body });
      const taskId = executableTask._id.toString();
      this.logger.debug(`${taskId} has been stored.`);
      req.body._id = taskId;
    }

    next();
  }
}
