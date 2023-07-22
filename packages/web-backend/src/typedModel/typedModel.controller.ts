import { Controller, Get, Post, Patch, Delete, Request, Param, Query, Body, UseGuards, HttpStatus, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalParameterDto } from 'src/hcl/dtos/global-parameter.dto';
import { HclModelTreeDto } from 'src/hcl/dtos/hcl-model-tree.dto';
import { HclModelDto } from 'src/hcl/dtos/hcl-model.dto';
import { PaginationDto } from 'src/hcl/dtos/pagination.dto';
import { GlobalParameter } from 'src/hcl/schemas/global-parameter.schema';
import { HclModelTree } from 'src/hcl/schemas/hcl-model-tree.schema';
import { HclModel } from 'src/hcl/schemas/hcl-model.schema';
import { OverviewTree } from 'src/hcl/schemas/overview-tree.schema';
import { TypedModelService } from './typedModel.service';
import { DEFAULT_TYPED_MODEL_JSON, TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import InternalEventsModel from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import InternalHazardsModel from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import ExternalHazardsModel from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import FullScopeModel from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";

@Controller()
@UseGuards(AuthGuard('jwt'))
export class TypedModelController {

  constructor(private typedModelService: TypedModelService) {}


  @Post('/internal-events/')
  async createInternalEvent( @Body() internalEventsModel: InternalEventsModel): Promise<InternalEventsModel> {
    return this.typedModelService.createInternalEventsModel(internalEventsModel)
  }


//   /**
//   * @param query Query string parameters
//   * @returns List of basic events' and house events' properties of all the fault trees of the model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/data/?model_id=1&basic_events=true&house_events=true
//   */
//   @Get('/data/')
//   async getHclModelData(@Query() query: { model_id: string, basic_events: string, house_events: string }) {
//     return this.hclService.getHclModelData(query.model_id, query.basic_events, query.house_events);
//   }

//   /**
//   * @param {string} model_id ID of the model
//   * @returns List of gates' properties of all the fault trees of the model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/data/gates/?model_id=1
//   */
//   @Get('/data/gates/')
//   async getHclModelGatesData(@Query('model_id') model_id: string) {
//     return this.hclService.getHclModelGatesData(model_id);
//   }


//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param query Query string parameters
//   * @returns List of HCL models
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/
//   */
//   @Get('/model/')
//   async getHclModelList(@Request() req, @Query() query: { tag?:string, limit?: string, offset?: string }): Promise<PaginationDto> {
//     if(!query.tag && !query.limit && !query.offset) {
//       return this.hclService.getHclModelList(req.user.user_id, req.originalUrl);
//     } else if(query.tag && !query.limit && !query.offset) {
//       return this.hclService.getHclModelList(req.user.user_id, req.originalUrl, query.tag);
//     } else if(query.tag && query.limit && query.offset) {
//       return this.hclService.getHclModelList(req.user.user_id, req.originalUrl, query.tag, undefined, query.limit, query.offset);
//     }
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "title":"Supply Chain Risk Assessment",
//   *   "description":"Assessing risk in different types of supply chains with a dynamic FT",
//   *   "assigned_users":[1,2]
//   * }
//   * @returns A mongoose document of the new model
//   * @example POST Request -> https://staging.app.openpra.org/api/hcl/model/
//   */
//   @Post('/model/')
//   async createHclModel(@Request() req, @Body() body: HclModelDto): Promise<HclModel> {
//     return this.hclService.createHclModel(req.user.user_id, req.user.username, body, req.originalUrl);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @returns An HCL model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/
//   */
//   @Get('/model/:model_id/')
//   async getHclModelById(@Request() req, @Param('model_id') model_id: string): Promise<HclModel> {
//     return this.hclService.getHclModelById(req.user.user_id, model_id);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "title":"Changing the title",
//   *   "description":"Fixed the description",
//   *   "assigned_users":[3,4]
//   * }
//   * or, { "tag":"PR" }
//   * or, { "overview_tree": 2 }
//   * @returns The updated HCL model
//   * @example PATCH Request -> https://staging.app.openpra.org/api/hcl/model/1/
//   */
//   @Patch('/model/:model_id/')
//   async updateHclModelById(@Request() req, @Param('model_id') model_id: string, @Body() body) {
//     return this.hclService.updateHclModelById(req.user.user_id, model_id, body);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @returns 204 HTTP status @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204}
//   * @example DELETE Request -> https://staging.app.openpra.org/api/hcl/model/1/
//   */
//   @Delete('/model/:model_id/')
//   async deleteHclModelById(@Request() req, @Param('model_id') model_id: string): Promise<HttpStatus> {
//     return this.hclService.deleteHclModelById(req.user.user_id, model_id);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "title":"Dynamic Reliability Analysis",
//   *   "description":"Event Sequence Diagram for Dynamic Reliability Analysis of NPP",
//   *   "assigned_users":[3,4]
//   * }
//   * @returns A mongoose document of the new model copy
//   * @example POST Request -> https://staging.app.openpra.org/api/hcl/model/1/copy/
//   */
//   @Post('/model/:model_id/copy/')
//   async copyHclModelById(@Request() req, @Param('model_id') model_id: string, @Body() body: HclModelDto) {
//     return this.hclService.copyHclModelById(req.user.user_id, model_id, req.user.username, body, req.originalUrl);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @returns The properties of the overview tree of an HCL model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/overview_tree/
//   */
//   @Get('/model/:model_id/overview_tree/')
//   async getHclModelOverviewTreeByModelId(@Request() req, @Param('model_id') model_id: string): Promise<OverviewTree> {
//     return this.hclService.getHclModelOverviewTreeByModelId(req.user.user_id, model_id);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param query Query string parameters
//   * @returns List of global parameters of an HCL model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/
//   */
//   @Get('/model/:model_id/parameter/')
//   async getGlobalParameterListByModelId(@Request() req, @Param('model_id') model_id: string, @Query() query: {limit?: string, offset?: string}): Promise<PaginationDto> {
//     if(query.limit && query.offset) {
//       return this.hclService.getGlobalParameterListByModelId(model_id, req.originalUrl, query.limit, query.offset);
//     } else {
//       return this.hclService.getGlobalParameterListByModelId(model_id, req.originalUrl);
//     }
//   }

//   /**
//   * @param {string} model_id ID of the model
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "parameter_name":"g",
//   *   "double_value":"9.8"
//   * }
//   * @returns A mongoose document of the new global parameter
//   * @example POST Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/
//   */
//   @Post('/model/:model_id/parameter/')
//   async createGlobalParameterByModelId(@Param('model_id') model_id: string, @Body() body: GlobalParameterDto): Promise<GlobalParameter> {
//     return this.hclService.createGlobalParameterByModelId(model_id, body);
//   }

//   /**
//   * @param params Path parameters
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "parameter_name":"gravitational acceleration",
//   *   "double_value":"10.0"
//   * }
//   * @returns The updated global parameter
//   * @example PATCH Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/1/
//   */
//   @Patch('/model/:model_id/parameter/:parameter_id/')
//   async partialUpdateGlobalParameterByModelAndParameterId(@Param() params: { model_id: string, parameter_id: string }, @Body() body: Partial<GlobalParameter>): Promise<GlobalParameter> {
//     return this.hclService.partialUpdateGlobalParameterByModelAndParameterId(params.model_id, params.parameter_id, body);
//   }

//   /**
//   * @param params Path parameters
//   * @returns 204 HTTP status @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204}
//   * @example DELETE Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/1/
//   */
//   @Delete('/model/:model_id/parameter/:parameter_id/')
//   async deleteGlobalParameterByModelAndParameterId(@Param() params: { model_id: string, parameter_id: string }): Promise<HttpStatus> {
//     return this.hclService.deleteGlobalParameterByModelAndParameterId(params.model_id, params.parameter_id);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param query Query string parameters
//   * @returns List of quantification data of an HCL model
//   * @example GET request -> https://staging.app.openpra.org/api/hcl/model/1/quantification/
//   */
//   @Get('/model/:model_id/quantification/')
//   async getHclModelQuantificationListById(@Request() req, @Param('model_id') model_id: string, @Query() query: { limit?: string, offset?: string }) {
//     if(query.limit && query.offset) {
//       return this.hclService.getHclModelQuantificationListById(model_id, req.originalUrl, query.limit, query.offset);
//     }
//     return this.hclService.getHclModelQuantificationListById(model_id, req.originalUrl);
//   }
  
//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "configuration":
//   *   {
//   *     "constructor": { "tree_id":558 },
//   *     "engine": {
// *         "BBNSolver":1000,
// *         "BDDConstructor":2001,
// *         "OrderingRule":3000 },
//   *     "quantify": {
//   *       "type": "uncertainty_at_fixed_time",
//   *       "mission_test_interval":100,
//   *       "user_defined_max_cutset":-1,
//   *       "targets":"__all__",
//   *       "sampling": {
//   *         "method":"monte_carlo",
//   *         "number_of_samples":1000,
//   *         "confidence_level":0.9 },
//   *       "importance": {
//   *         "events":"all",
//   *         "measures":["all"] } }
//   *   }
//   * }
//   * @returns A mongoose document of the new quantification result
//   * @example POST request -> https://staging.app.openpra.org/api/hcl/model/1/quantification/
//   */
//   @Post('/model/:model_id/quantification/')
//   async hclModelQuantificationById(@Request() req, @Param('model_id') model_id: string, @Body() body) {
//     return this.hclService.hclModelQuantificationById(req.user.user_id, model_id, body, req.originalUrl);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param query Query string parameters
//   * @returns List of trees of an HCL model
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?limit=10&offset=0
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?type=f
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?type=f&limit=10&offset=0
//   */
//   @Get('/model/:model_id/tree/')
//   async getHclModelTreeListByModelId(@Request() req, @Param('model_id') model_id: string, @Query() query: { type?: string, limit?: string, offset?: string }): Promise<PaginationDto> {
//     if(query.type && !query.limit && !query.offset) {
//       return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, query.type, undefined, undefined);
//     } else if(!query.type && query.limit && query.offset) {
//       return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, undefined, query.limit, query.offset);
//     } else if(query.type && query.limit && query.offset) {
//       return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, query.type, query.limit, query.offset);
//     } else {
//       return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, undefined, undefined, undefined);
//     }
//   }


//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} model_id ID of the model
//   * @param body Request body
//   * @example Request body sample:
//   * {
//   *   "title":"Scenarios resulting from hydrogen gas releases",
//   *   "description":"QRA for vehicular hydrogen applications",
//   *   "tree_type":"e",
//   *   "tree_data": {}
//   * }
//   * @returns A mongoose document of the new fault tree / event sequence diagram / bayesian neural network
//   * @example POST Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/
//   */
//   @Post('/model/:model_id/tree/')
//   async createHclModelTreeByModelId(@Request() req, @Param('model_id') model_id: string, @Body() body: HclModelTreeDto) {
//     if(body.tree_type === 'f') {
//       return this.hclService.createFaultTreeByModelId(req.user.user_id, req.user.username, model_id, body);
//     } else if(body.tree_type === 'e') {
//       return this.hclService.createEventSequenceDiagramByModelId(req.user.user_id, req.user.username, model_id, body);
//     } else if(body.tree_type === 'b') {
//       return this.hclService.createBayesianNetworksByModelId(req.user.user_id, req.user.username, model_id, body);
//     }
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param query Query string parameters
//   * @returns List of all trees
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/tree/
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/tree/?limit=10&offset=0
//   */
//   @Get('/tree/')
//   async getHclTreeList(@Req() req, @Query() query: { limit?: string, offset?: string }) {
//     if(query.limit && query.offset) {
//       return this.hclService.getHclTreeList(req.originalUrl, query.limit, query.offset);
//     } else {
//       return this.hclService.getHclTreeList(req.originalUrl);
//     }
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} tree_id ID of the tree
//   * @param {string} include_tree_data Whether additional data will be included with the result or not
//   * @returns A certain tree
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/tree/1/
//   * @example GET Request -> https://staging.app.openpra.org/api/hcl/tree/1/?include_tree_data=true
//   */
//   @Get('/tree/:tree_id/')
//   async getHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Query('include_tree_data') include_tree_data: string): Promise<HclModelTree> {
//     if(include_tree_data) {
//       return this.hclService.getHclTreeById(req.user.user_id, tree_id, include_tree_data);
//     } else {
//       return this.hclService.getHclTreeById(req.user.user_id, tree_id);
//     }
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} tree_id ID of the tree
//   * @param body Request body
//   * @returns The updated tree
//   * @example PATCH Request -> https://staging.app.openpra.org/api/hcl/tree/1/
//   */
//   @Patch('/tree/:tree_id/')
//   async updateHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Body() body) {
//     return this.hclService.updateHclTreeById(req.user.user_id, tree_id, body);
//   }

//   /**
//   * @param {string} tree_id ID of the tree
//   * @returns 204 HTTP status @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204}
//   * @example DELETE Request -> https://staging.app.openpra.org/api/hcl/tree/1/
//   */
//   @Delete('/tree/:tree_id/')
//   async deleteHclTreeById(@Param('tree_id') tree_id: string): Promise<HttpStatus> {
//     return this.hclService.deleteHclTreeById(tree_id);
//   }

//   /**
//   * @param req Express request object @see {@link https://expressjs.com/en/api.html#req}
//   * @param {string} tree_id ID of the tree
//   * @param {string} recurse Whether the linked trees will be copied as well or not
//   * @returns A mongoose document of the new tree copy
//   * @example POST request -> https://staging.app.openpra.org/api/hcl/tree/1/copy/
//   * @example POST request -> https://staging.app.openpra.org/api/hcl/tree/1/copy/?recurse=true
//   */
//   @Post('/tree/:tree_id/copy/')
//   async copyHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Query('recurse') recurse?: string) {
//     if(recurse && recurse === 'true') {
//       return this.hclService.copyHclTreeByIdWithLinkedTrees(req.user.user_id, req.user.username, tree_id);
//     } else {
//       return this.hclService.copyHclTreeById(req.user.user_id, req.user.username, tree_id);
//     }
//   }
}