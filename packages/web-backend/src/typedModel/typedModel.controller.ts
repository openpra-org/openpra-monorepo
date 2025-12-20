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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InternalEventsModel } from 'shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel';
import { InternalHazardsModel } from 'shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel';
import { FullScopeModel } from 'shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel';
import { ExternalHazardsModel } from 'shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel';
import { InvalidTokenFilter } from '../filters/invalid-token.filter';
import { TypedModelService } from './typedModel.service';
import { InternalEvents } from './schemas/internal-events.schema';
import { InternalHazards } from './schemas/internal-hazards.schema';
import { ExternalHazards } from './schemas/external-hazards.schema';
import { FullScope } from './schemas/full-scope.schema';
import {
  TypedModel,
  TypedModelJSON,
} from './schemas/templateSchema/typed-model.schema';

/**
 * Controller for typed model CRUD and metadata endpoints.
 * Manages Internal/External Hazards, Full Scope, and Internal Events models.
 * @public
 */
@Controller()
@UseGuards(AuthGuard('jwt'))
@UseFilters(InvalidTokenFilter)
export class TypedModelController {
  /**
   * Construct controller with typed model service dependency.
   *
   * @param typedModelService - Service handling typed model CRUD and queries
   */
  constructor(private readonly typedModelService: TypedModelService) {}

  //all the post methods go here

  private getUserId(req: unknown): number | undefined {
    const u = (req as { user?: { user_id?: unknown } })?.user?.user_id;
    return typeof u === 'number'
      ? u
      : typeof u === 'string'
        ? Number(u)
        : undefined;
  }

  /**
   *
   * @param internalEventsModel - takes in an internal events model that needs to be added to the database with a dummy id
   * @returns a promise of internalEventsModel
   */
  @Post('/internal-events/')
  async createInternalEvent(
    @Body() internalEventsModel: Partial<InternalEvents>,
  ): Promise<TypedModel> {
    return this.typedModelService.createInternalEventModel(internalEventsModel);
  }

  /**
   *
   * @param internalHazardsModel - takes in an internalHazardsModel with all fields but a dummy id
   * @returns a promise with an internalHazardsModel
   */
  @Post('/internal-hazards/')
  async createInternalHazard(
    @Body() internalHazardsModel: Partial<InternalHazards>,
  ): Promise<TypedModel> {
    return this.typedModelService.createInternalHazardModel(
      internalHazardsModel,
    );
  }

  /**
   *
   * @param externalHazardsModel - takes in an externalHazardsModel with all fields, and a dummy id
   * @returns promise of an externalHazardsModel
   */
  @Post('/external-hazards/')
  async createExternalHazard(
    @Body() externalHazardsModel: Partial<ExternalHazards>,
  ): Promise<TypedModel> {
    return this.typedModelService.createExternalHazardModel(
      externalHazardsModel,
    );
  }

  /**
   *
   * @param fullScopeModel - takes in a fullScopeModel with a dummy id
   * @returns a promise of fullScopeModel
   */
  @Post('/full-scope/')
  async createFullScope(
    @Body() fullScopeModel: Partial<FullScope>,
  ): Promise<TypedModel> {
    return this.typedModelService.createFullScopeModel(fullScopeModel);
  }

  //patch methods, used because there is a lot of nested data that is handled at those endpoints in the future

  /**
   * gets a single internal event
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @param model - partial model payload to patch
   * @returns the internal event the user has with the modelId
   */
  @Patch('/internal-events/:id/')
  async patchInternalEvent(
    @Request() req,
    @Param('id') modelId: string,
    @Body() model: Partial<InternalEvents>,
  ): Promise<InternalEvents> {
    return this.typedModelService.patchInternalEvent(
      modelId,
      this.getUserId(req) as number,
      model,
    );
  }

  /**
   * gets a single internal hazard
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @param model - partial model payload to patch
   * @returns the internal hazard the user has with the modelId
   */
  @Patch('/internal-hazards/:id/')
  async patchInternalHazard(
    @Request() req,
    @Param('id') modelId: string,
    @Body() model: Partial<InternalHazards>,
  ): Promise<InternalHazards> {
    return this.typedModelService.patchInternalHazard(
      modelId,
      this.getUserId(req) as number,
      model,
    );
  }

  /**
   * updates and replaces a single
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @param model - partial model payload to patch
   * @returns the external hazard the user has with the modelId
   */
  @Patch('/external-hazards/:id/')
  async patchExternalHazard(
    @Request() req,
    @Param('id') modelId: string,
    @Body() model: Partial<ExternalHazards>,
  ): Promise<ExternalHazards> {
    return this.typedModelService.patchExternalHazard(
      modelId,
      this.getUserId(req) as number,
      model,
    );
  }

  /**
   * gets a single full scope
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @param model - partial model payload to patch
   * @returns the full scope the user has with the modelId
   */
  @Patch('/full-scope/:id/')
  async patchFullScope(
    @Request() req,
    @Param('id') modelId: string,
    @Body() model: Partial<FullScope>,
  ): Promise<FullScope> {
    return this.typedModelService.patchFullScope(
      modelId,
      this.getUserId(req) as number,
      model,
    );
  }

  //get methods for collections

  /**
   *
   * @param req - the request providing the user id
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get('/internal-events/')
  async getInternalEvents(@Request() req): Promise<InternalEvents[]> {
    return this.typedModelService.getInternalEvents(
      this.getUserId(req) as number,
    );
  }

  /**
   *
   * @param req - the request providing the user id
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get('/internal-hazards/')
  async getInternalHazards(@Request() req): Promise<InternalHazards[]> {
    return this.typedModelService.getInternalHazards(
      this.getUserId(req) as number,
    );
  }

  /**
   *
   * @param req - the request providing the user id
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get('/external-hazards/')
  async getExternalHazards(@Request() req): Promise<ExternalHazards[]> {
    return this.typedModelService.getExternalHazards(
      this.getUserId(req) as number,
    );
  }

  /**
   *
   * @param req - the request providing the user id
   * @returns a list of the full scope models the user is on
   */
  @Get('/full-scope/')
  async getFullScopes(@Request() req): Promise<FullScope[]> {
    return this.typedModelService.getFullScopes(this.getUserId(req) as number);
  }

  //get methods for singles

  /**
   * gets a single internal event
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @returns the internal event the user has with the modelId
   */
  @Get('/internal-events/:id/')
  async getInternalEvent(
    @Request() req,
    @Param('id') modelId: string,
  ): Promise<InternalEvents> {
    return this.typedModelService.getInternalEvent(
      modelId,
      this.getUserId(req) as number,
    );
  }

  /**
   * gets a single internal hazard
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @returns the internal hazard the user has with the modelId
   */
  @Get('/internal-hazards/:id/')
  async getInternalHazard(
    @Request() req,
    @Param('id') modelId: string,
  ): Promise<InternalHazards> {
    return this.typedModelService.getInternalHazard(
      modelId,
      this.getUserId(req) as number,
    );
  }

  /**
   * gets a single external hazard
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @returns the external hazard the user has with the modelId
   */
  @Get('/external-hazards/:id/')
  async getExternalHazard(
    @Request() req,
    @Param('id') modelId: string,
  ): Promise<ExternalHazards> {
    return this.typedModelService.getExternalHazard(
      modelId,
      this.getUserId(req) as number,
    );
  }

  /**
   * gets a single full scope
   * @param req - Express request (user context)
   * @param modelId - id of the model to be returned
   * @returns the full scope the user has with the modelId
   */
  @Get('/full-scope/:id/')
  async getFullScope(
    @Request() req,
    @Param('id') modelId: string,
  ): Promise<FullScope> {
    return this.typedModelService.getFullScope(
      modelId,
      this.getUserId(req) as number,
    );
  }

  //delete methods

  /**
   *
   * @param req - Express request (user context)
   * @param modelId - id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete('/internal-events/')
  async deleteInternalEvent(
    @Request() req,
    @Query('modelId') modelId: string,
  ): Promise<InternalEventsModel> {
    return this.typedModelService.deleteInternalEvent(
      Number(modelId),
      this.getUserId(req) as number,
    );
  }

  /**
   *
   * @param req - Express request (user context)
   * @param modelId - id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete('/external-hazards/')
  async deleteExternalHazard(
    @Request() req,
    @Query('modelId') modelId: string,
  ): Promise<ExternalHazardsModel> {
    return this.typedModelService.deleteExternalHazard(
      Number(modelId),
      this.getUserId(req) as number,
    );
  }

  /**
   *
   * @param req - Express request (user context)
   * @param modelId - id of the model to be deleted
   * @returns the deleted model in a promise
   */
  @Delete('/internal-hazards/')
  async deleteInternalHazard(
    @Request() req,
    @Query('modelId') modelId: string,
  ): Promise<InternalHazardsModel> {
    return this.typedModelService.deleteInternalHazard(
      Number(modelId),
      this.getUserId(req) as number,
    );
  }

  /**
   * Delete a Full Scope model by id.
   *
   * @param req - Express request (provides user id)
   * @param modelId - id of the model to delete
   * @returns the deleted model
   */
  @Delete('/full-scope/')
  async deleteFullScope(
    @Request() req,
    @Query('modelId') modelId: string,
  ): Promise<FullScopeModel> {
    return this.typedModelService.deleteFullScope(
      Number(modelId),
      this.getUserId(req) as number,
    );
  }

  //endpoints for adding a nested model id

  /**
   * updates internal events model
   * @param body - modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch('/internal-events/')
  async addNestedToInternalEvent(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToInternalEvent(
      body.modelId,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * updates internal hazards model
   * @param body - modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch('/internal-hazards/')
  async addNestedToInternalHazard(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToInternalHazard(
      body.modelId,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * updates external hazards model
   * @param body - modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch('/external-hazard/')
  async addNestedToExternalHazard(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToExternalHazard(
      body.modelId,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * updates full scope model
   * @param body - modelId number, nestedId number, and a nestedType camelCase string
   * @returns promise with udpated model
   */
  @Patch('/full-scope/')
  async addNestedToFullScope(
    @Body() body: { modelId: number; nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.addNestedToFullScope(
      body.modelId,
      body.nestedId,
      body.nestedType,
    );
  }

  //for deleting nested model ids

  /**
   * Remove a nested model relation from an Internal Events model.
   *
   * @param id - Internal Events model identifier
   * @param body - Object containing nestedId and nestedType to remove
   * @returns Updated model JSON
   */
  @Patch('/internal-events/:id/delete-nested')
  async deleteNestedFromInternalEvent(
    @Param('id') id: string,
    @Body() body: { nestedId: number | string; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromInternalEvent(
      id,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * Remove a nested model relation from an Internal Hazards model.
   *
   * @param id - Internal Hazards model identifier
   * @param body - Object containing nestedId and nestedType to remove
   * @returns Updated model JSON
   */
  @Patch('/internal-hazards/:id/delete-nested')
  async deleteNestedFromInternalHazard(
    @Param('id') id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromInternalHazard(
      id,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * Remove a nested model relation from an External Hazards model.
   *
   * @param id - External Hazards model identifier
   * @param body - Object containing nestedId and nestedType to remove
   * @returns Updated model JSON
   */
  @Patch('/external-hazards/:id/delete-nested')
  async deleteNestedFromExternalHazard(
    @Param('id') id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromExternalHazard(
      id,
      body.nestedId,
      body.nestedType,
    );
  }

  /**
   * Remove a nested model relation from a Full Scope model.
   *
   * @param id - Full Scope model identifier
   * @param body - Object containing nestedId and nestedType to remove
   * @returns Updated model JSON
   */
  @Patch('/full-scope/:id/delete-nested')
  async deleteNestedFromFullScope(
    @Param('id') id: string,
    @Body() body: { nestedId: number; nestedType: string },
  ): Promise<TypedModelJSON> {
    return this.typedModelService.deleteNestedFromFullScope(
      id,
      body.nestedId,
      body.nestedType,
    );
  }
}
