import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecuteJobBrokerTask, QuantifyJobBrokerRequest } from "./schemas/job-broker.schema";

@Injectable()
export class JobBrokerMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(QuantifyJobBrokerRequest.name)
    private readonly quantifyJobBrokerModel: Model<QuantifyJobBrokerRequest>,
    @InjectModel(ExecuteJobBrokerTask.name) private readonly executeJobBrokerModel: Model<ExecuteJobBrokerTask>,
  ) {}

  private isQuantifyRequest(body: any): body is QuantifyRequest {
    return body && Array.isArray(body.models) && body.models.every((item: any) => typeof item === "string");
  }

  private isExecutionTask(body: any): body is ExecutionTask {
    const executables = ["scram-cli", "saphsolve", "ftrex", "xfta", "xfta2", "dpc", "acube", "qrecover"];
    return body && typeof body.executable === "string" && executables.includes(body.executable);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (this.isQuantifyRequest(req.body)) {
      await this.quantifyJobBrokerModel.create({ configuration: req.body });
    } else if (this.isExecutionTask(req.body)) {
      await this.executeJobBrokerModel.create({ task: req.body });
    }

    next();
  }
}
