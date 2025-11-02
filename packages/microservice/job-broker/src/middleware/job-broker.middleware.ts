import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { QuantifyRequest } from "mef-types/openpra-mef/util/quantify-request";
import type { ExecutionTask } from "mef-types/openpra-mef/util/execution-task";
import { QuantificationJobReport } from "./schemas/quantification-job.schema";
import { ExecutableJobReport } from "./schemas/executable-job.schema";

/**
 * Middleware that creates placeholder MongoDB documents and injects IDs into incoming requests.
 *
 * - For quantification jobs, creates a QuantificationJobReport and adds `_id` to the request body.
 * - For executable tasks, creates an ExecutableJobReport and adds `_id` to the request body.
 */
@Injectable()
export class JobBrokerMiddleware implements NestMiddleware {
  /**
   * Construct the middleware with MongoDB models for placeholder job records.
   *
   * @param quantificationJobModel - Mongoose model for quantification jobs; used to create a placeholder document per request
   * @param executableJobModel - Mongoose model for executable tasks; used to create a placeholder document per request
   */
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

  /**
   * Express middleware entrypoint that inspects the request body and creates a
   * placeholder MongoDB document for either a quantification job or an executable task.
   * The created document's id is injected into the request body as `_id`.
   *
   * @param req - Incoming HTTP request
   * @param res - HTTP response
   * @param next - Next function in the middleware chain
   */
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
