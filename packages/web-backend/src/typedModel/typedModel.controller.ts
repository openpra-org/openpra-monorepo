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

  /**
   * Creates a new model of the specified type.
   * @param type - The type of the model (e.g., internal-events, external-hazards).
   * @param modelData - The data for creating the new model.
   * @returns The created model.
   */
  @Post("/:type/")
  async createModel(@Param("type") type: string, @Body() modelData: Record<string, any>): Promise<any> {
    return this.typedModelService.createModel(type, modelData);
  }

  /**
   * Updates an existing model by ID.
   * @param type - The type of the model (e.g., internal-events, external-hazards).
   * @param modelId - The ID of the model to be updated.
   * @param req - The request object containing user information.
   * @param modelData - The data for updating the model.
   * @returns The updated model.
   */
  @Patch("/:type/:id/")
  async patchModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Request() req,
    @Body() modelData: Record<string, any>,
  ): Promise<any> {
    return this.typedModelService.patchModel(type, modelId, req.user.user_id, modelData);
  }

  /**
   * Retrieves all models of the specified type for the authenticated user.
   * @param type - The type of the model (e.g., internal-events, external-hazards).
   * @param req - The request object containing user information.
   * @returns A list of models of the specified type for the user.
   */
  @Get("/:type/")
  async getModels(@Param("type") type: string, @Request() req): Promise<any[]> {
    return this.typedModelService.getModels(type, req.user.user_id);
  }

  /**
   * Retrieves a specific model by its ID for the authenticated user.
   * @param type - The type of the model (e.g., internal-events, external-hazards).
   * @param modelId - The ID of the model to retrieve.
   * @param req - The request object containing user information.
   * @returns The requested model if found.
   */ @Get("/:type/:id/")
  async getModel(@Param("type") type: string, @Param("id") modelId: string, @Request() req): Promise<any> {
    return this.typedModelService.getModel(type, modelId, req.user.user_id);
  }

  /**
   * Deletes a model by its ID for the authenticated user.
   * @param type - The type of the model (e.g., internal-events, external-hazards).
   * @param modelId - The ID of the model to delete.
   * @param req - The request object containing user information.
   * @returns The deleted model or confirmation of deletion.
   */
  @Delete("/:type/:id/")
  async deleteModel(@Param("type") type: string, @Param("id") modelId: string, @Request() req): Promise<any> {
    return this.typedModelService.deleteModel(type, modelId, req.user.user_id);
  }

  /**
   * Adds a nested model to a parent model.
   * @param type - The type of the parent model.
   * @param modelId - The ID of the parent model.
   * @param body - The body containing the nested model's ID and type.
   * @returns The updated parent model with the added nested model.
   */
  @Patch("/:type/:id/add-nested/")
  async addNestedModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedModel(type, modelId, body.nestedId, body.nestedType);
  }

  /**
   * Deletes a nested model from a parent model.
   * @param type - The type of the parent model.
   * @param modelId - The ID of the parent model.
   * @param body - The body containing the nested model's ID and type.
   * @returns The updated parent model without the nested model.
   */ @Patch("/:type/:id/delete-nested/")
  async deleteNestedModel(
    @Param("type") type: string,
    @Param("id") modelId: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedModel(type, modelId, body.nestedId, body.nestedType);
  }
}
