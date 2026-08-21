import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type MethodModelCreateRequest,
  type MethodModelExecuteRequest,
  type MethodModelExecuteResult,
  type MethodModelDependenciesResponse,
  type MethodAnalysisRunResult,
  type MethodModelListResponse,
  type MethodModelPatchRequest,
  type MethodModelValidateRequest,
  type MethodType,
  type NewlyDevelopedMethodModel,
  type AnalysisReadyValidationOutcome,
  type AnalysisRunMetadata,
  type DraftValidationOutcome,
  MethodModelCreateRequestSchema,
  MethodModelExecuteRequestSchema,
  MethodModelPatchRequestSchema,
  MethodModelValidateRequestSchema,
  MethodTypeSchema,
} from "interfaces-shared-types/newly-developed-methods";
import { JwtAuthGuard, type AuthenticatedRequest } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../pipe/zod-validation.pipe";
import { MethodModelsService } from "./method-models.service";

@Controller("projects/:projectId/method-models")
@UseGuards(JwtAuthGuard)
class MethodModelsController {
  constructor(private readonly methodModelsService: MethodModelsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @Param("projectId") projectId: string,
    @Query("methodType", new ZodValidationPipe(MethodTypeSchema)) methodType: MethodType,
    @Req() request: AuthenticatedRequest,
  ): Promise<MethodModelListResponse> {
    return this.methodModelsService.listProjectModels(projectId, methodType, {
      username: request.user!.username,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(MethodModelCreateRequestSchema)) body: MethodModelCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<NewlyDevelopedMethodModel> {
    return this.methodModelsService.createModel(projectId, body, {
      username: request.user!.username,
    });
  }

  @Get(":modelId")
  @HttpCode(HttpStatus.OK)
  load(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<NewlyDevelopedMethodModel> {
    return this.methodModelsService.loadModel(projectId, modelId, {
      username: request.user!.username,
    });
  }

  @Get(":modelId/dependencies")
  @HttpCode(HttpStatus.OK)
  findDependencies(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MethodModelDependenciesResponse> {
    return this.methodModelsService.findModelDependencies(projectId, modelId, {
      username: request.user!.username,
    });
  }

  @Patch(":modelId")
  @HttpCode(HttpStatus.OK)
  patch(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Body(new ZodValidationPipe(MethodModelPatchRequestSchema)) body: MethodModelPatchRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<NewlyDevelopedMethodModel> {
    return this.methodModelsService.patchModel(projectId, modelId, body, {
      username: request.user!.username,
    });
  }

  @Post(":modelId/validate")
  @HttpCode(HttpStatus.OK)
  validate(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Body(new ZodValidationPipe(MethodModelValidateRequestSchema)) body: MethodModelValidateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<DraftValidationOutcome | AnalysisReadyValidationOutcome> {
    return this.methodModelsService.validateModel(projectId, modelId, body, {
      username: request.user!.username,
    });
  }

  @Post(":modelId/runs")
  @HttpCode(HttpStatus.ACCEPTED)
  createAnalysisRun(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Body(new ZodValidationPipe(MethodModelExecuteRequestSchema)) body: MethodModelExecuteRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<MethodModelExecuteResult> {
    return this.methodModelsService.createAnalysisRun(projectId, modelId, body, {
      username: request.user!.username,
    });
  }

  @Get(":modelId/runs/:runId")
  @HttpCode(HttpStatus.OK)
  getAnalysisRun(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalysisRunMetadata> {
    return this.methodModelsService.getAnalysisRun(projectId, modelId, runId, {
      username: request.user!.username,
    });
  }

  @Get(":modelId/runs/:runId/result")
  @HttpCode(HttpStatus.OK)
  getAnalysisRunResult(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("runId") runId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MethodAnalysisRunResult> {
    return this.methodModelsService.getAnalysisRunResult(projectId, modelId, runId, {
      username: request.user!.username,
    });
  }

  @Delete(":modelId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.methodModelsService.deleteModel(projectId, modelId, {
      username: request.user!.username,
    });
  }
}

export { MethodModelsController };
