import { Controller, Param, Body, Get, Post, Patch, Delete, UseGuards, UseFilters } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { TypedModelService } from "./typedModel.service";
import {
  TypedModelDeleteRequest,
  TypedModelGetRequest,
  TypedModelNestedDeleteRequest,
  TypedModelNestedPatchRequest,
  TypedModelPatchRequest,
  TypedModelPostRequest,
} from "shared-types/src/openpra-mef-types/api/TypedModelRequest";
import { TypedModel } from "shared-types/src/openpra-mef-types/modelTypes/largeModels/TypedModel";

@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class TypedModelController {
  constructor(private readonly typedModelService: TypedModelService) {}

  // Get Typed Models
  /**
   *
   * @body name of the typed model and ID of user
   * @returns a list of the typed models that the user is part of
   */

  @Get("/")
  async getTypedModels(@Body() typedModelReq: TypedModelGetRequest): Promise<TypedModel[]> {
    return this.typedModelService.getTypedModels(typedModelReq);
  }

  // Get Typed Model by ID
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model and ID of user
   * @returns a list of the typed models that the user is part of
   */

  @Get("/:modelId")
  async getTypedModel(@Param("modelId") modelId: string, @Body() typedModelReq: TypedModelGetRequest): Promise<TypedModel> {
    return this.typedModelService.getTypedModel(typedModelReq, modelId);
  }

  // Create Typed Model
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model, IDs of users, name and description of the model
   * @returns the created typed model
   */

  @Post("/")
  async createTypedModel(@Body() typedModel: TypedModelPostRequest): Promise<TypedModel> {
    return this.typedModelService.createTypedModel(typedModel);
  }

  // Edit Typed Model
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model, IDs of user, fields of the model that are changed
   * @returns the edited typed model
   */

  @Patch("/:modelId")
  async patchTypedModel(
    @Param("modelId") modelId: string,
    @Body() typedModelReq: TypedModelPatchRequest,
  ): Promise<TypedModel> {
    return this.typedModelService.patchTypedModel(modelId, typedModelReq);
  }

  // Delete Typed Model
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model, IDs of user
   * @returns the deleted typed model incase of only 1 user or the typed model with the user removed
   */

  @Delete("/:modelId")
  async deleteTypedModel(
    @Param("modelId") modelId: string,
    @Body() typedModelReq: TypedModelDeleteRequest,
  ): Promise<TypedModel> {
    return this.typedModelService.deleteTypedModel(modelId, typedModelReq);
  }

  // Add Nested Model to a Typed Model
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model, IDs of user, type and ID of the nested model
   * @returns the edited typed model
   */

  @Patch("/:modelId/nested-model")
  async addNestedToTypedModel(
    @Param("modelId") modelId: string,
    @Body() typedModelReq: TypedModelNestedPatchRequest,
  ): Promise<TypedModel> {
    return this.typedModelService.addNestedToTypedModel(modelId, typedModelReq);
  }

  // Delete Nested Model from a Typed Model
  /**
   *
   * @param modelId of the typed model
   * @body name of the typed model, IDs of user, type and ID of the nested model
   * @returns the edited typed model
   */

  @Delete("/:modelId/nested-model")
  async deleteNestedFromTypedModel(
    @Param("modelId") modelId: string,
    @Body() typedModelReq: TypedModelNestedDeleteRequest,
  ): Promise<TypedModel> {
    return this.typedModelService.deleteNestedFromTypedModel(modelId, typedModelReq);
  }
}
