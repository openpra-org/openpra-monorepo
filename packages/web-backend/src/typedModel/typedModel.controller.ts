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
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { TypedModelService } from "./typedModel.service";
import { TypedModel, TypedModelJSON } from "./schemas/templateSchema/typed-model.schema";

@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class TypedModelController {
  constructor(private readonly typedModelService: TypedModelService) {}

  // POST: Create a new model
  @Post("/:type/")
  async createModel(@Param("type") type: string, @Body() modelData: Record<string, any>): Promise<any> {
    return this.typedModelService.createModel(type, modelData);
  }

  // PATCH: Update a model
  @Patch("/:type/:id/")
  async patchModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Request() req,
    @Body() modelData: Record<string, any>,
  ): Promise<any> {
    return this.typedModelService.patchModel(type, modelId, req.user.user_id, modelData);
  }

  // GET: Fetch all models of a type for a user
  @Get("/:type/")
  async getModels(@Param("type") type: string, @Request() req): Promise<any[]> {
    return this.typedModelService.getModels(type, req.user.user_id);
  }

  // GET: Fetch a single model by ID
  @Get("/:type/:id/")
  async getModel(@Param("type") type: string, @Param("id") modelId: string, @Request() req): Promise<any> {
    return this.typedModelService.getModel(type, modelId, req.user.user_id);
  }

  // DELETE: Delete a model by ID
  @Delete("/:type/:id/")
  async deleteModel(@Param("type") type: string, @Param("id") modelId: string, @Request() req): Promise<any> {
    return this.typedModelService.deleteModel(type, modelId, req.user.user_id);
  }

  // PATCH: Add a nested model to a parent model
  @Patch("/:type/:id/add-nested/")
  async addNestedModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedModel(type, modelId, body.nestedId, body.nestedType);
  }

  // PATCH: Delete a nested model from a parent model
  @Patch("/:type/:id/delete-nested/")
  async deleteNestedModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedModel(type, modelId, body.nestedId, body.nestedType);
  }
}
