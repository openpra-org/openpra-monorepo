import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { PraetorJobState } from "interfaces-shared-types/execution/praetor-job";
import { NATIVE_DEADLINE_HEADER, type NativeResponse } from "praxis-node/protocol";
import { ApiTags } from "@nestjs/swagger";
import type { ExecuteRequest, ExecuteSolver } from "../../common/types/execute-request";
import { getSolverDescriptor } from "../solvers.registry";
import { ExecuteProducerService } from "../services/execute-producer.service";
import { ExecuteStorageService } from "../services/execute-storage.service";
import { PraxisJobsService, type PraxisJobRequest } from "../services/praxis-jobs.service";

function deadlineOf(request: Request): number | undefined {
  const header = request.headers[NATIVE_DEADLINE_HEADER];
  if (header === undefined) return undefined;
  if (typeof header !== "string" || header.length === 0 || [...header].some((character) => character < "0" || character > "9") || !Number.isSafeInteger(Number(header))) {
    throw new BadRequestException("Invalid PRAXIS execution deadline");
  }
  return Number(header);
}

function disconnection(request: Request, response: Response): AbortSignal {
  const controller = new AbortController();
  const cancel = (): void => {
    if (!response.writableEnded) controller.abort();
  };
  response.once("close", cancel);
  request.once("aborted", cancel);
  return controller.signal;
}

function requestObject(body: object | null): object {
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("A versioned PRAXIS request body is required.");
  return body;
}

@ApiTags("Solver Execution")
@Controller()
export class ExecuteController {
  constructor(
    private readonly producerService: ExecuteProducerService,
    private readonly storageService: ExecuteStorageService,
    private readonly praxisJobs: PraxisJobsService,
  ) {}

  @Post("praxis/native/validate")
  @HttpCode(HttpStatus.OK)
  public async validatePraxisNative(@Body() body: object | null, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<NativeResponse> {
    return this.praxisJobs.run("validate", requestObject(body), deadlineOf(req), disconnection(req, res));
  }

  @Post("praxis/native/execute")
  @HttpCode(HttpStatus.OK)
  public async executePraxisNative(@Body() body: object | null, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<NativeResponse> {
    return this.praxisJobs.run("execute", requestObject(body), deadlineOf(req), disconnection(req, res));
  }

  @Post("praxis/jobs")
  @HttpCode(HttpStatus.ACCEPTED)
  public async submitPraxisJob(@Body() body: PraxisJobRequest): Promise<PraetorJobState> {
    return this.praxisJobs.submit(body);
  }

  @Get("praxis/jobs/:jobId")
  public async praxisJobState(@Param("jobId") jobId: string): Promise<PraetorJobState> {
    return this.praxisJobs.state(jobId);
  }

  @Get("praxis/jobs/:jobId/result")
  public async praxisJobResult(@Param("jobId") jobId: string): Promise<NativeResponse> {
    return this.praxisJobs.result(jobId);
  }

  @Delete("praxis/jobs/:jobId")
  public async cancelPraxisJob(@Param("jobId") jobId: string): Promise<PraetorJobState> {
    return this.praxisJobs.cancel(jobId);
  }

  @Post("scram/execute")
  public async executeScram(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("scram", request);
  }

  @Post("praxis/execute")
  public async executePraxis(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("praxis", request);
  }

  @Post("xfta/execute")
  public async executeXfta(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("xfta", request);
  }

  @Post("ftrex/execute")
  public async executeFtrex(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("ftrex", request);
  }

  @Post("zebra/execute")
  public async executeZebra(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("zebra", request);
  }

  @Post("saphsolve/execute")
  public async executeSaphsolve(@Body() request: ExecuteRequest): Promise<{ jobId: string }> {
    return this.queue("saphsolve", request);
  }

  @Get("execute/input/:inputId")
  public async getInput(@Param("inputId") inputId: string): Promise<string> {
    try {
      return await this.storageService.getInputData(inputId);
    } catch {
      throw new NotFoundException(`Input data with ID ${inputId} not found.`);
    }
  }

  @Get("execute/output/:outputId")
  public async getOutput(@Param("outputId") outputId: string): Promise<string> {
    try {
      return await this.storageService.getOutputData(outputId);
    } catch {
      throw new NotFoundException(`Output data with ID ${outputId} not found.`);
    }
  }

  private async queue(solver: ExecuteSolver, request: ExecuteRequest): Promise<{ jobId: string }> {
    if (!getSolverDescriptor(solver).implemented) {
      throw new NotImplementedException(`Solver '${solver}' execute endpoint is not implemented yet.`);
    }
    if (request === undefined || typeof request.input !== "string" || request.input.length === 0) {
      throw new BadRequestException('Execute request requires a base64-encoded "input" field.');
    }
    try {
      const jobId = await this.producerService.createAndQueueExecute(solver, {
        argv: typeof request.argv === "string" ? request.argv : "",
        input: request.input,
      });
      return { jobId };
    } catch {
      throw new InternalServerErrorException(`Server encountered a problem while queueing ${solver} execute job.`);
    }
  }
}
