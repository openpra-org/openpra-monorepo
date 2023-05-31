import { Controller, Get, Post, Patch, Delete, Request, Param, Query, Body } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HclService } from './hcl.service';
import { GlobalParameterDto } from './dtos/global-parameter.dto';
import { HclModelDto } from './dtos/hcl-model.dto';
import{ HclModelTreeDto } from './dtos/hcl-model-tree.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { GlobalParameterListResponseDto } from './dtos/global-parameter-list-response.dto';
import { GlobalParameterResponseDto } from './dtos/global-parameter-response.dto';
import { GlobalParameter } from './schemas/global-parameter.schema';
import { HclModel } from "./schemas/hcl-model.schema";
import{ HclModelTree } from './schemas/hcl-model-tree.schema';
import { Serialize } from './interceptors/serialize.interceptor';


@Controller()
@UseGuards(AuthGuard('jwt'))
export class HclController { 
  constructor(private hclService: HclService) {}

  @Get('/model')
  async getHclModelList(@Query() query: { limit: any, offset: any }, @Request() req) {
    const user_id = req.user.user_id;
    const url = req.originalUrl;
    return this.hclService.getHclModelList(url, user_id, query.limit, query.offset);
  }

  @Post('/model/')
  async createHclModel(@Request() req, @Body() body: HclModelDto) {
    const user_id = req.user.user_id;
    return this.hclService.createHclModel(user_id, body);
  }

  @Patch('/model/:model_id')
  async updateHclModel(@Param('model_id') model_id, @Body() body: Partial<HclModel>): Promise<HclModel> {
    return this.hclService.updateHclModel(model_id, body);
  }

  @Serialize(GlobalParameterListResponseDto)
  @Get('/model/:model_id/parameter')
  async getGlobalParameterList(@Param('model_id') model_id, @Query() query: {limit?: any, offset?: any}, @Request() req): Promise<PaginationDto> {
    const url = req.originalUrl;
    if(query) {
      return this.hclService.getGlobalParameterList(url, req.user.user_id, model_id, query.limit, query.offset);
    } else {
      return this.hclService.getGlobalParameterList(url, req.user.user_id, model_id);
    }
  }
  
  @Serialize(GlobalParameterResponseDto)
  @Post('/model/:model_id/parameter')
  async createGlobalParameter(@Param('model_id') model_id: string, @Request() req, @Body() body: GlobalParameterDto): Promise<GlobalParameter> {
    return this.hclService.createGlobalParameter(req.user.user_id, model_id, body);
  }

  @Serialize(GlobalParameterResponseDto)
  @Patch('/model/:model_id/parameter/:parameter_id')
  async partialUpdateGlobalParameter(@Param() params: { model_id: string, parameter_id: string }, @Request() req, @Body() body: Partial<GlobalParameter>): Promise<GlobalParameter> {
    return this.hclService.partialUpdateGlobalParameter(req.user.user_id, params.model_id, params.parameter_id, body);
  }

  @Delete('/model/:model_id/parameter/:parameter_id')
  async deleteGlobalParameter(@Param() params: { model_id: string, parameter_id: string }, @Request() req): Promise<any> {
    return this.hclService.deleteGlobalParameter(req.user.user_id, params.model_id, params.parameter_id);
  }
    
  @Post('/model/:model_id/tree')
  async createHclModelTree(@Param('model_id') model_id: string, @Body() body:HclModelTreeDto) : Promise<HclModelTree> {
    return this.hclService.createHclModelTree(model_id, body);
  }
}