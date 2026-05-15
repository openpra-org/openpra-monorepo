import {
  Controller,
  Request,
  Param,
  Query,
  Body,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InternalEventsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { InternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { FullScopeModel } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ExternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { TypedModelService } from "./typedModel.service";
import { InternalEvents } from "./schemas/internal-events.schema";
import { InternalHazards } from "./schemas/internal-hazards.schema";
import { ExternalHazards } from "./schemas/external-hazards.schema";
import { FullScope } from "./schemas/full-scope.schema";
import { TypedModel, TypedModelJSON } from "./schemas/templateSchema/typed-model.schema";
@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class TypedModelController {
  constructor(private readonly typedModelService: TypedModelService) {}
  private getUserId(req: unknown): number | undefined {
    const u = (
      req as {
        user?: {
          user_id?: unknown;
        };
      }
    )?.user?.user_id;
    return (
      typeof u === "number" ? u
      : typeof u === "string" ? Number(u)
      : undefined
    );
  }
  @Post("/internal-events/")
  async createInternalEvent(
    @Body()
    internalEventsModel: Partial<InternalEvents>,
  ): Promise<TypedModel> {
    return this.typedModelService.createInternalEventModel(internalEventsModel);
  }
  @Post("/internal-hazards/")
  async createInternalHazard(
    @Body()
    internalHazardsModel: Partial<InternalHazards>,
  ): Promise<TypedModel> {
    return this.typedModelService.createInternalHazardModel(internalHazardsModel);
  }
  @Post("/external-hazards/")
  async createExternalHazard(
    @Body()
    externalHazardsModel: Partial<ExternalHazards>,
  ): Promise<TypedModel> {
    return this.typedModelService.createExternalHazardModel(externalHazardsModel);
  }
  @Post("/full-scope/")
  async createFullScope(
    @Body()
    fullScopeModel: Partial<FullScope>,
  ): Promise<TypedModel> {
    return this.typedModelService.createFullScopeModel(fullScopeModel);
  }
  @Patch("/internal-events/:id/")
  async patchInternalEvent(
    @Request()
    req,
    @Param("id")
    modelId: string,
    @Body()
    model: Partial<InternalEvents>,
  ): Promise<InternalEvents> {
    return this.typedModelService.patchInternalEvent(modelId, this.getUserId(req) as number, model);
  }
  @Patch("/internal-hazards/:id/")
  async patchInternalHazard(
    @Request()
    req,
    @Param("id")
    modelId: string,
    @Body()
    model: Partial<InternalHazards>,
  ): Promise<InternalHazards> {
    return this.typedModelService.patchInternalHazard(modelId, this.getUserId(req) as number, model);
  }
  @Patch("/external-hazards/:id/")
  async patchExternalHazard(
    @Request()
    req,
    @Param("id")
    modelId: string,
    @Body()
    model: Partial<ExternalHazards>,
  ): Promise<ExternalHazards> {
    return this.typedModelService.patchExternalHazard(modelId, this.getUserId(req) as number, model);
  }
  @Patch("/full-scope/:id/")
  async patchFullScope(
    @Request()
    req,
    @Param("id")
    modelId: string,
    @Body()
    model: Partial<FullScope>,
  ): Promise<FullScope> {
    return this.typedModelService.patchFullScope(modelId, this.getUserId(req) as number, model);
  }
  @Get("/internal-events/")
  async getInternalEvents(
    @Request()
    req,
  ): Promise<InternalEvents[]> {
    return this.typedModelService.getInternalEvents(this.getUserId(req) as number);
  }
  @Get("/internal-hazards/")
  async getInternalHazards(
    @Request()
    req,
  ): Promise<InternalHazards[]> {
    return this.typedModelService.getInternalHazards(this.getUserId(req) as number);
  }
  @Get("/external-hazards/")
  async getExternalHazards(
    @Request()
    req,
  ): Promise<ExternalHazards[]> {
    return this.typedModelService.getExternalHazards(this.getUserId(req) as number);
  }
  @Get("/full-scope/")
  async getFullScopes(
    @Request()
    req,
  ): Promise<FullScope[]> {
    return this.typedModelService.getFullScopes(this.getUserId(req) as number);
  }
  @Get("/internal-events/:id/")
  async getInternalEvent(
    @Request()
    req,
    @Param("id")
    modelId: string,
  ): Promise<InternalEvents> {
    return this.typedModelService.getInternalEvent(modelId, this.getUserId(req) as number);
  }
  @Get("/internal-hazards/:id/")
  async getInternalHazard(
    @Request()
    req,
    @Param("id")
    modelId: string,
  ): Promise<InternalHazards> {
    return this.typedModelService.getInternalHazard(modelId, this.getUserId(req) as number);
  }
  @Get("/external-hazards/:id/")
  async getExternalHazard(
    @Request()
    req,
    @Param("id")
    modelId: string,
  ): Promise<ExternalHazards> {
    return this.typedModelService.getExternalHazard(modelId, this.getUserId(req) as number);
  }
  @Get("/full-scope/:id/")
  async getFullScope(
    @Request()
    req,
    @Param("id")
    modelId: string,
  ): Promise<FullScope> {
    return this.typedModelService.getFullScope(modelId, this.getUserId(req) as number);
  }
  @Delete("/internal-events/")
  async deleteInternalEvent(
    @Request()
    req,
    @Query("modelId")
    modelId: string,
  ): Promise<InternalEventsModel> {
    return this.typedModelService.deleteInternalEvent(Number(modelId), this.getUserId(req) as number);
  }
  @Delete("/external-hazards/")
  async deleteExternalHazard(
    @Request()
    req,
    @Query("modelId")
    modelId: string,
  ): Promise<ExternalHazardsModel> {
    return this.typedModelService.deleteExternalHazard(Number(modelId), this.getUserId(req) as number);
  }
  @Delete("/internal-hazards/")
  async deleteInternalHazard(
    @Request()
    req,
    @Query("modelId")
    modelId: string,
  ): Promise<InternalHazardsModel> {
    return this.typedModelService.deleteInternalHazard(Number(modelId), this.getUserId(req) as number);
  }
  @Delete("/full-scope/")
  async deleteFullScope(
    @Request()
    req,
    @Query("modelId")
    modelId: string,
  ): Promise<FullScopeModel> {
    return this.typedModelService.deleteFullScope(Number(modelId), this.getUserId(req) as number);
  }
  @Patch("/internal-events/")
  async addNestedToInternalEvent(
    @Body()
    body: {
      modelId: number;
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToInternalEvent(body.modelId, body.nestedId, body.nestedType);
  }
  @Patch("/internal-hazards/")
  async addNestedToInternalHazard(
    @Body()
    body: {
      modelId: number;
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToInternalHazard(body.modelId, body.nestedId, body.nestedType);
  }
  @Patch("/external-hazard/")
  async addNestedToExternalHazard(
    @Body()
    body: {
      modelId: number;
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToExternalHazard(body.modelId, body.nestedId, body.nestedType);
  }
  @Patch("/full-scope/")
  async addNestedToFullScope(
    @Body()
    body: {
      modelId: number;
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToFullScope(body.modelId, body.nestedId, body.nestedType);
  }
  @Patch("/internal-events/:id/delete-nested")
  async deleteNestedFromInternalEvent(
    @Param("id")
    id: string,
    @Body()
    body: {
      nestedId: number | string;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromInternalEvent(id, body.nestedId, body.nestedType);
  }
  @Patch("/internal-hazards/:id/delete-nested")
  async deleteNestedFromInternalHazard(
    @Param("id")
    id: string,
    @Body()
    body: {
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromInternalHazard(id, body.nestedId, body.nestedType);
  }
  @Patch("/external-hazards/:id/delete-nested")
  async deleteNestedFromExternalHazard(
    @Param("id")
    id: string,
    @Body()
    body: {
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromExternalHazard(id, body.nestedId, body.nestedType);
  }
  @Patch("/full-scope/:id/delete-nested")
  async deleteNestedFromFullScope(
    @Param("id")
    id: string,
    @Body()
    body: {
      nestedId: number;
      nestedType: string;
    },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromFullScope(id, body.nestedId, body.nestedType);
  }
}
