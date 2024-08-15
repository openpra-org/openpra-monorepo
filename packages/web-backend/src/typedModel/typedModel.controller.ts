import { Controller, Request, Param, Query, Body, Get, Post, Patch, Delete, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InternalEventsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { InternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { FullScopeModel } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ExternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { TypedModelService } from "./typedModel.service";
import { InternalEvents } from "./schemas/internal-events.schema";
import { InternalHazards } from "./schemas/internal-hazards.schema";
import { ExternalHazards } from "./schemas/external-hazards.schema";
import { FullScope } from "./schemas/full-scope.schema";
import { TypedModel, TypedModelJSON } from "./schemas/templateSchema/typed-model.schema";

@Controller()
@UseGuards(AuthGuard("jwt"))
export class TypedModelController {
  constructor(private readonly typedModelService: TypedModelService) {}

  //all the post methods go here

  /**
   *
   * @param internalEventsModel takes in an internal events model that needs to be added to the database with a dummy id
   * @returns a promise of internalEventsModel
   */
  @Post("/internal-events/")
  async createInternalEvent(@Body() internalEventsModel: Partial<InternalEvents>): Promise<TypedModel> {
    return this.typedModelService.createInternalEventModel(internalEventsModel);
  }

  /**
   *
   * @param internalHazardsModel takes in an internalHazardsModel with all fields but a dummy id
   * @returns a promise with an internalHazardsModel
   */
  @Post("/internal-hazards/")
  async createInternalHazard(@Body() internalHazardsModel: Partial<InternalHazards>): Promise<TypedModel> {
    return this.typedModelService.createInternalHazardModel(internalHazardsModel);
  }

  /**
   *
   * @param externalHazardsModel takes in an externalHazardsModel with all fields, and a dummy id
   * @returns promise of an externalHazardsModel
   */
  @Post("/external-hazards/")
  async createExternalHazard(@Body() externalHazardsModel: Partial<ExternalHazards>): Promise<TypedModel> {
    return this.typedModelService.createExternalHazardModel(externalHazardsModel);
  }

  /**
   *
   * @param fullScopeModel takes in a fullScopeModel with a dummy id
   * @returns a promise of fullScopeModel
   */
  @Post("/full-scope/")
  async createFullScope(@Body() fullScopeModel: Partial<FullScope>): Promise<TypedModel> {
    return this.typedModelService.createFullScopeModel(fullScopeModel);
  }

  //patch methods, used because there is a lot of nested data that is handled at those endpoints in the future

  /**
   * gets a single internal event
   * @param req
   * @param modelId id of the model to be returned
   * @param model
   * @returns the internal event the user has with the modelId
   */
  @Patch("/internal-events/:id/")
  async patchInternalEvent(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
    @Body() model: Partial<InternalEvents>,
  ): Promise<InternalEvents | null> {
    return this.typedModelService.patchInternalEvent(modelId, req.user.user_id, model);
  }

  /**
   * gets a single internal hazard
   * @param req
   * @param modelId id of the model to be returned
   * @param model
   * @returns the internal hazard the user has with the modelId
   */
  @Patch("/internal-hazards/:id/")
  async patchInternalHazard(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
    @Body() model: Partial<InternalHazards>,
  ): Promise<InternalHazards | null> {
    return this.typedModelService.patchInternalHazard(modelId, req.user.user_id, model);
  }

  /**
   * updates and replaces a single
   * @param req
   * @param modelId id of the model to be returned
   * @param model
   * @returns the external hazard the user has with the modelId
   */
  @Patch("/external-hazards/:id/")
  async patchExternalHazard(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
    @Body() model: Partial<ExternalHazards>,
  ): Promise<ExternalHazards | null> {
    return this.typedModelService.patchExternalHazard(modelId, req.user.user_id, model);
  }

  /**
   * gets a single full scope
   * @param req
   * @param modelId id of the model to be returned
   * @param model
   * @returns the full scope the user has with the modelId
   */
  @Patch("/full-scope/:id/")
  async patchFullScope(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
    @Body() model: Partial<FullScope>,
  ): Promise<FullScope | null> {
    return this.typedModelService.patchFullScope(modelId, req.user.user_id, model);
  }

  //get methods for collections

  /**
   *
   * @returns a list of the internal hazards moodels the user is on
   * @param req
   */
  @Get("/internal-events/")
  async getInternalEvents(@Request() req: { user: { user_id: number } }): Promise<InternalEvents[]> {
    return this.typedModelService.getInternalEvents(req.user.user_id);
  }

  /**
   *
   * @param id the id of the user whose models you want to retrieve
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get("/internal-hazards/")
  async getInternalHazards(@Request() req: { user: { user_id: number } }): Promise<InternalHazards[]> {
    return this.typedModelService.getInternalHazards(req.user.user_id);
  }

  /**
   *
   * @param id the id of the user whose models you want to retrieve
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get("/external-hazards/")
  async getExternalHazards(@Request() req: { user: { user_id: number } }): Promise<ExternalHazards[]> {
    return this.typedModelService.getExternalHazards(req.user.user_id);
  }

  /**
   *
   * @param id the id of the user whose models you want to retrieve
   * @returns a list of the full scope models the user is on
   */
  @Get("/full-scope/")
  async getFullScopes(@Request() req: { user: { user_id: number } }): Promise<FullScope[]> {
    return this.typedModelService.getFullScopes(req.user.user_id);
  }

  //get methods for singles

  /**
   * gets a single internal event
   * @param req
   * @param modelId id of the model to be returned
   * @returns the internal event the user has with the modelId
   */
  @Get("/internal-events/:id/")
  async getInternalEvent(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
  ): Promise<InternalEvents | null> {
    return this.typedModelService.getInternalEvent(modelId, req.user.user_id);
  }

  /**
   * gets a single internal hazard
   * @param req
   * @param modelId id of the model to be returned
   * @returns the internal hazard the user has with the modelId
   */
  @Get("/internal-hazards/:id/")
  async getInternalHazard(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
  ): Promise<InternalHazards | null> {
    return this.typedModelService.getInternalHazard(modelId, req.user.user_id);
  }

  /**
   * gets a single external hazard
   * @param req
   * @param modelId id of the model to be returned
   * @returns the external hazard the user has with the modelId
   */
  @Get("/external-hazards/:id/")
  async getExternalHazard(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
  ): Promise<ExternalHazards | null> {
    return this.typedModelService.getExternalHazard(modelId, req.user.user_id);
  }

  /**
   * gets a single full scope
   * @param req
   * @param modelId id of the model to be returned
   * @returns the full scope the user has with the modelId
   */
  @Get("/full-scope/:id/")
  async getFullScope(
    @Request() req: { user: { user_id: number } },
    @Param("id") modelId: string,
  ): Promise<FullScope | null> {
    return this.typedModelService.getFullScope(modelId, req.user.user_id);
  }

  //delete methods

  /**
   *
   * @param req
   * @param modelId id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete("/internal-events/")
  async deleteInternalEvent(
    @Request() req: { user: { user_id: number } },
    @Query("modelId") modelId: string,
  ): Promise<InternalEventsModel | null> {
    return this.typedModelService.deleteInternalEvent(Number(modelId), req.user.user_id);
  }

  /**
   *
   * @param req
   * @param modelId id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete("/external-hazards/")
  async deleteExternalHazard(
    @Request() req: { user: { user_id: number } },
    @Query("modelId") modelId: string,
  ): Promise<ExternalHazardsModel | null> {
    return this.typedModelService.deleteExternalHazard(Number(modelId), req.user.user_id);
  }

  /**
   *
   * @param req
   * @param modelId id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete("/internal-hazards/")
  async deleteInternalHazard(
    @Request() req: { user: { user_id: number } },
    @Query("modelId") modelId: string,
  ): Promise<InternalHazardsModel | null> {
    return this.typedModelService.deleteInternalHazard(Number(modelId), req.user.user_id);
  }

  @Delete("/full-scope/")
  async deleteFullScope(
    @Request() req: { user: { user_id: number } },
    @Query("modelId") modelId: string,
  ): Promise<FullScopeModel | null> {
    return this.typedModelService.deleteFullScope(Number(modelId), req.user.user_id);
  }

  //endpoints for adding a nested model id

  /**
   * updates internal events model
   * @param body modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch("/internal-events/")
  async addNestedToInternalEvent(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.addNestedToInternalEvent(body.modelId, body.nestedId, body.nestedType);
  }

  /**
   * updates internal hazards model
   * @param body modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch("/internal-hazards/")
  async addNestedToInternalHazard(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.addNestedToInternalHazard(body.modelId, body.nestedId, body.nestedType);
  }

  /**
   * updates external hazards model
   * @param body modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch("/external-hazard/")
  async addNestedToExternalHazard(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.addNestedToExternalHazard(body.modelId, body.nestedId, body.nestedType);
  }

  /**
   * updates full scope model
   * @param body modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch("/full-scope/")
  async addNestedToFullScope(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.addNestedToFullScope(body.modelId, body.nestedId, body.nestedType);
  }

  //for deleting nested model ids

  @Patch("/internal-events/:id/delete-nested")
  async deleteNestedFromInternalEvent(
    @Param("id") id: string,
    @Body() body: { nestedId: number | string; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.deleteNestedFromInternalEvent(id, body.nestedId, body.nestedType);
  }

  @Patch("/internal-hazards/:id/delete-nested")
  async deleteNestedFromInternalHazard(
    @Param("id") id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.deleteNestedFromInternalHazard(id, body.nestedId, body.nestedType);
  }

  @Patch("/external-hazards/:id/delete-nested")
  async deleteNestedFromExternalHazard(
    @Param("id") id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.deleteNestedFromExternalHazard(id, body.nestedId, body.nestedType);
  }

  @Patch("/full-scope/:id/delete-nested")
  async deleteNestedFromFullScope(
    @Param("id") id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON | null> {
    return this.typedModelService.deleteNestedFromFullScope(id, body.nestedId, body.nestedType);
  }
}
