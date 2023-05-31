import { Controller, Options, Get, Post, Patch, Delete, Request, Param, Query, Body, UseGuards, HttpStatus, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// import { ApiTags } from '@nestjs/swagger';
import { HclService } from './hcl.service';
import { GlobalParameterDto } from './dtos/global-parameter.dto';
import { HclModelDto } from './dtos/hcl-model.dto';
import{ HclModelTreeDto } from './dtos/hcl-model-tree.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { GlobalParameter } from './schemas/global-parameter.schema';
import { HclModel } from './schemas/hcl-model.schema';
import { HclModelTree } from './schemas/hcl-model-tree.schema';
import { OverviewTree } from './schemas/overview-tree.schema';


// @ApiTags('HCL Endpoints')
@Controller()
export class HclController {
  constructor(private hclService: HclService) {}

  /*
    'Preflighted' requests are sent to the server via OPTIONS request method to find out:
        1. Which 'origin' is permitted to make request to these URLs.
        2. What kind of 'request methods' (e.g. GET, POST, PATCH, PUT, DELETE request methods) are permitted on these URLs.
        3. Which 'request headers' are permitted.
        4. How long these permissions can be cached.
    To find out more about OPTIONS request methods, visit:
        https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS and go through the 'Preflighted requests in CORS' section.
    All the configurations for the Preflighted requests for this project are available in 'src/main.ts' file under app.enableCors() method.
  */

  @Options('/data/')
  async getHclModelData_Options() {}

  @Options('/data/gates/')
  async getHclModelGatesData_Options() {}

  @Options('/model/')
  async getHclModelList_createHclModel_Options() {}

  @Options('/model/:model_id/')
  async getHclModelById_updateHclModelById_deleteHclModelById_Options() {}

  @Options('/model/:model_id/copy/')
  async copyHclModelById_Options() {}

  @Options('/model/:model_id/overview_tree/')
  async getHclModelOverviewTreeByModelId_Options() {}

  @Options('/model/:model_id/parameter/')
  async getGlobalParameterListByModelId_createGlobalParameterByModelId_Options() {}

  @Options('/model/:model_id/parameter/:parameter_id/')
  async partialUpdateGlobalParameterByModelAndParameterId_DeleteGlobalParameterByModelAndParameterId_Options() {}

  @Options('/model/:model_id/quantification/')
  async hclModelQuantificationById_Options() {}

  @Options('/model/:model_id/tree/')
  async getHclModelTreeListByModelId_createHclModelTreeByModelId_Options() {}

  @Options('/tree/')
  async getHclTreeList_Options() {}

  @Options('/tree/:tree_id/')
  async getHclTreeById_updateHclTreeById_deleteHclTreeById_Options() {}

  @Options('/tree/:tree_id/copy/')
  async copyHclTreeById_Options() {}

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/data/?model_id=1&basic_events=true&house_events=true
    Retrieves a list of fault trees of a certain HCL Model (that matches the provided model ID) with only their basic events' and house events' data.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/data/')
  async getHclModelData(@Query() query: { model_id: string, basic_events: string, house_events: string }) {
    return this.hclService.getHclModelData(query.model_id, query.basic_events, query.house_events);
  }

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/data/gates/?model_id=1
    Retrieves a list of fault trees of a certain HCL Model with only their gates' data.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/data/gates/')
  async getHclModelGatesData(@Query() query: { model_id: string }) {
    return this.hclService.getHclModelGatesData(query.model_id);
  }


  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/model/
    Retrieves a list of all the HCL Models assigned to the current user. The web-app can perform risk assessment for 3 types of programs:
      1. Projects ('PR')
      2. Components ('CO')
      3. Subsystems ('SU')
    By default, the web-app treats a newly created HCL Model as a component ('CO').
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/model/')
  async getHclModelList(@Request() req, @Query() query: { tag?:string, limit?: any, offset?: any }): Promise<PaginationDto> {
    if(!query.tag && !query.limit && !query.offset) {
      return this.hclService.getHclModelList(req.user.user_id, req.originalUrl);
    } else if(query.tag && !query.limit && !query.offset) {
      return this.hclService.getHclModelList(req.user.user_id, req.originalUrl, query.tag);
    } else if(query.tag && query.limit && query.offset) {
      return this.hclService.getHclModelList(req.user.user_id, req.originalUrl, query.tag, undefined, query.limit, query.offset);
    }
  }

  /*
    POST Request -> https://staging.app.openpra.org/api/hcl/model/
    Creates a new HCL Model with the provided data and later adds some hard-coded data with this newly created Model.
    An example of the request body for creating a new HCL Model:
      {
        "title":"Supply Chain Risk Assessment",
        "description":"Assessing risk in different types of supply chains with a dynamic fault tree",
        "assigned_users":[1,2]
      }
  */
  @UseGuards(AuthGuard('jwt'))
  @Post('/model/')
  async createHclModel(@Request() req, @Body() body: HclModelDto): Promise<HclModel> {
    return this.hclService.createHclModel(req.user.user_id, req.user.username, body, req.originalUrl);
  }

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/
    Retrieves an HCL Model with the help of the provided Model ID.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/model/:model_id/')
  async getHclModelById(@Request() req, @Param('model_id') model_id: string): Promise<HclModel> {
    return this.hclService.getHclModelById(req.user.user_id, model_id);
  }

  /*
    PATCH Request -> https://staging.app.openpra.org/api/hcl/model/1/
    Updates an HCL Model with the provided data. Examples of the request body for updating an HCL Model:
      {
        "title":"Changing the title",
        "description":"Fixed the description",
        "assigned_users":[3,4]
      }
      or, { "tag":"PR" }
      or, { "overview_tree": 2 }
  */
  @UseGuards(AuthGuard('jwt'))
  @Patch('/model/:model_id/')
  async updateHclModelById(@Request() req, @Param('model_id') model_id: string, @Body() body) {
    return this.hclService.updateHclModelById(req.user.user_id, model_id, body);
  }

  /*
    DELETE Request -> https://staging.app.openpra.org/api/hcl/model/1/
    Deletes an HCL Model with the help of the provided Model ID.
  */
  @UseGuards(AuthGuard('jwt'))
  @Delete('/model/:model_id/')
  async deleteHclModelById(@Request() req, @Param('model_id') model_id: string): Promise<HttpStatus> {
    return this.hclService.deleteHclModelById(req.user.user_id, model_id);
  }

  /*
    POST Request -> https://staging.app.openpra.org/api/hcl/model/1/copy/
    Creates a copy of an existing HCL Model but with different title, description, and assigned_users. Aside from these 3 fields all the other underlying information
    of the existing Model will be copied to the new Model such as the HCL trees, the overview tree, global parameters, quantification history etc.
  */
  @UseGuards(AuthGuard('jwt'))
  @Post('/model/:model_id/copy/')
  async copyHclModelById(@Request() req, @Param('model_id') model_id: string, @Body() body: HclModelDto) {
    return this.hclService.copyHclModelById(req.user.user_id, model_id, req.user.username, body, req.originalUrl);
  }

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/overview_tree/
    Retrieves the information about the overview tree of a certain model.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/model/:model_id/overview_tree/')
  async getHclModelOverviewTreeByModelId(@Request() req, @Param('model_id') model_id: string): Promise<OverviewTree> {
    return this.hclService.getHclModelOverviewTreeByModelId(req.user.user_id, model_id);
  }

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/
    Retrieves a list of all the global parameters of a certain HCL Model.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/model/:model_id/parameter/')
  async getGlobalParameterListByModelId(@Request() req, @Param('model_id') model_id: string, @Query() query: {limit?: any, offset?: any}): Promise<PaginationDto> {
    if(query.limit && query.offset) {
      return this.hclService.getGlobalParameterListByModelId(model_id, req.originalUrl, query.limit, query.offset);
    } else {
      return this.hclService.getGlobalParameterListByModelId(model_id, req.originalUrl);
    }
  }

  /*
    POST Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/
    Creates a new global parameter inside a certain HCL Model. An example of the request body for creating a global parameter:
      {
        "parameter_name":"g",
        "double_value": "9.8"
      }
  */
  @UseGuards(AuthGuard('jwt'))
  @Post('/model/:model_id/parameter/')
  async createGlobalParameterByModelId(@Param('model_id') model_id: string, @Body() body: GlobalParameterDto): Promise<GlobalParameter> {
    return this.hclService.createGlobalParameterByModelId(model_id, body);
  }

  /*
    PATCH Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/1/
    Updates a certain global parameter using the provided 'pk' (or ID) and Model ID.
  */
  @UseGuards(AuthGuard('jwt'))
  @Patch('/model/:model_id/parameter/:parameter_id/')
  async partialUpdateGlobalParameterByModelAndParameterId(@Param() params: { model_id: string, parameter_id: string }, @Body() body: Partial<GlobalParameter>): Promise<GlobalParameter> {
    return this.hclService.partialUpdateGlobalParameterByModelAndParameterId(params.model_id, params.parameter_id, body);
  }

  /*
    DELETE Request -> https://staging.app.openpra.org/api/hcl/model/1/parameter/1/
    Deletes a global parameter with the help of the provided 'pk' (or ID) and Model ID.
  */
  @UseGuards(AuthGuard('jwt'))
  @Delete('/model/:model_id/parameter/:parameter_id/')
  async deleteGlobalParameterByModelAndParameterId(@Param() params: { model_id: string, parameter_id: string }): Promise<HttpStatus> {
    return this.hclService.deleteGlobalParameterByModelAndParameterId(params.model_id, params.parameter_id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/model/:model_id/quantification/')
  async hclModelQuantificationById(@Request() req, @Param('model_id') model_id: string, @Body() body) {
    return this.hclService.hclModelQuantificationById(req.user.user_id, model_id, body, req.originalUrl);
  }

  /*
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?limit=10&offset=0
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?type=f
    GET Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/?type=f&limit=10&offset=0
    Either retrieves a list of all the HCL trees under a certain Model or retrieves a list of trees under a certain model by their type
    (fault tree: 'f', event sequence diagram: 'e' or bayesian networks: 'b').
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/model/:model_id/tree/')
  async getHclModelTreeListByModelId(@Request() req, @Param('model_id') model_id: string, @Query() query: { type?: string, limit?: any, offset?: any }): Promise<PaginationDto> {
    if(query.type && !query.limit && !query.offset) {
      return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, query.type, undefined, undefined);
    } else if(!query.type && query.limit && query.offset) {
      return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, undefined, query.limit, query.offset);
    } else if(query.type && query.limit && query.offset) {
      return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, query.type, query.limit, query.offset);
    } else {
      return this.hclService.getHclModelTreeListByModelId(model_id, req.originalUrl, undefined, undefined, undefined);
    }
  }


  /*
  POST Request -> https://staging.app.openpra.org/api/hcl/model/1/tree/
  Creates an HCL tree inside a certain HCL Model. HCL trees can be of 3 types: Fault Trees (FT), Event Sequence Diagrams (ESD), and Bayesian Networks (BN).
  An example of the request body for creating an HCL tree:
    {
      "title":"Scenarios resulting from hydrogen gas releases",
      "description":"QRA for vehicular hydrogen applications",
      "tree_type":"e",
      "tree_data": {}
    }
  */
  @UseGuards(AuthGuard('jwt'))
  @Post('/model/:model_id/tree/')
  async createHclModelTreeByModelId(@Request() req, @Param('model_id') model_id: string, @Body() body: HclModelTreeDto) {
    if(body.tree_type === 'f') {
      return this.hclService.createFaultTreeByModelId(req.user.user_id, req.user.username, model_id, body);
    } else if(body.tree_type === 'e') {
      return this.hclService.createEventSequenceDiagramByModelId(req.user.user_id, req.user.username, model_id, body);
    } else if(body.tree_type === 'b') {
      return this.hclService.createBayesianNetworksByModelId(req.user.user_id, req.user.username, model_id, body);
    }
  }

  /*
  GET Request -> https://staging.app.openpra.org/api/hcl/tree/
  GET Request -> https://staging.app.openpra.org/api/hcl/tree/?limit=10&offset=0
  Retrieves the list of all the HCL trees created by all the users.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/tree/')
  async getHclTreeList(@Req() req, @Query() query: { limit?: any, offset?: any }) {
    if(query.limit && query.offset) {
      return this.hclService.getHclTreeList(req.originalUrl, query.limit, query.offset);
    } else {
      return this.hclService.getHclTreeList(req.originalUrl);
    }
  }

  /*
  GET Request -> https://staging.app.openpra.org/api/hcl/tree/1/
  GET Request -> https://staging.app.openpra.org/api/hcl/tree/1/?include_tree_data=true
  Retrieves a certain HCL tree with the help of the provided tree ID. The data might include or exclude the 'tree_data' object based on the include_tree_data value.
  */
  @UseGuards(AuthGuard('jwt'))
  @Get('/tree/:tree_id/')
  async getHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Query() query: { include_tree_data?: string }): Promise<HclModelTree> {
    if(query.include_tree_data) {
      return this.hclService.getHclTreeById(req.user.user_id, tree_id, query.include_tree_data);
    } else {
      return this.hclService.getHclTreeById(req.user.user_id, tree_id);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/tree/:tree_id/')
  async updateHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Body() body) {
    return this.hclService.updateHclTreeById(req.user.user_id, tree_id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('/tree/:tree_id/')
  async deleteHclTreeById(@Request() req, @Param('tree_id') tree_id: string): Promise<HttpStatus> {
    return this.hclService.deleteHclTreeById(req.user.user_id, tree_id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/tree/:tree_id/copy/')
  async copyHclTreeById(@Request() req, @Param('tree_id') tree_id: string, @Query() query: { recurse?: string }) {
    if(query.recurse && query.recurse === 'true') {
      return this.hclService.copyHclTreeByIdWithLinkedTrees(req.user.user_id, req.user.username, tree_id);
    } else {
      return this.hclService.copyHclTreeById(req.user.user_id, req.user.username, tree_id);
    }
  }
}
