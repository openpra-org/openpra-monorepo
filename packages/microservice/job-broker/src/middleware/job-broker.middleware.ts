import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantifyRequest } from "mef-types/openpra-mef/util/quantify-request";
import { ExecutionTask } from "mef-types/openpra-mef/util/execution-task";
import { QuantificationJobReport } from "./schemas/quantification-job.schema";
import { ExecutableJobReport } from "./schemas/executable-job.schema";

@Injectable()
export class JobBrokerMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
  ) {}

  private isQuantifyRequest(body: unknown): body is QuantifyRequest {
    if (typeof body !== "object" || body === null) return false;
    const b = body as { models?: unknown };
    return Array.isArray(b.models) && (b.models as unknown[]).every((item) => typeof item === "string");
  }

  private isExecutionTask(body: unknown): body is ExecutionTask {
    const executables: ReadonlyArray<string> = [
      "scram-cli",
      "saphsolve",
      "ftrex",
      "xfta",
      "xfta2",
      "dpc",
      "acube",
      "qrecover",
    ];
    if (typeof body !== "object" || body === null) return false;
    const b = body as { executable?: unknown };
    return typeof b.executable === "string" && executables.includes(b.executable);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    console.log("Checking whether it is a quantification or executable request");
    const body = req.body as unknown;
    if (this.isQuantifyRequest(body)) {
      console.log("Creating a MongoDB document to store the quantification request");
      const quantificationJob = await this.quantificationJobModel.create({ configuration: body });
      type QuantifyRequestWithId = QuantifyRequest & { _id?: string };
      const qb = body as QuantifyRequestWithId;
      qb._id = quantificationJob._id.toString();
      req.body = qb as QuantifyRequest & { _id: string };
    } else if (this.isExecutionTask(body)) {
      const executableJob = await this.executableJobModel.create({ task: body });
      type ExecutionTaskWithId = ExecutionTask & { _id?: string };
      const eb = body as ExecutionTaskWithId;
      eb._id = executableJob._id.toString();
      req.body = eb as ExecutionTask & { _id: string };
    }

    next();
  }
}
