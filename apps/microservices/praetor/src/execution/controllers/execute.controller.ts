import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
  Param,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ExecuteRequest, ExecuteSolver } from "../../common/types/execute-request";
import { getSolverDescriptor } from "../solvers.registry";
import { ExecuteProducerService } from "../services/execute-producer.service";
import { ExecuteStorageService } from "../services/execute-storage.service";
import { PraxisNativeService } from "../services/praxis-native.service";

@ApiTags("Solver Execution")
@Controller()
export class ExecuteController {
  constructor(
    private readonly producerService: ExecuteProducerService,
    private readonly storageService: ExecuteStorageService,
    private readonly praxisNativeService: PraxisNativeService,
  ) {}

  @Post("praxis/native/validate")
  @HttpCode(HttpStatus.OK)
  public async validatePraxisNative(@Body() request: unknown): Promise<Record<string, unknown>> {
    return this.praxisNativeService.run("validate", request);
  }

  @Post("praxis/native/execute")
  @HttpCode(HttpStatus.OK)
  public async executePraxisNative(@Body() request: unknown): Promise<Record<string, unknown>> {
    return this.praxisNativeService.run("execute", request);
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
