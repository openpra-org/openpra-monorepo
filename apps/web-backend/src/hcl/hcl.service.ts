import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GlobalParameterDto } from './dtos/global-parameter.dto';
import { HclModelDto } from './dtos/hcl-model.dto';
import { HclModelTreeDto } from './dtos/hcl-model-tree.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { GlobalParameter, GlobalParameterDocument } from './schemas/global-parameter.schema';
import { HclModel, HclModelDocument } from './schemas/hcl-model.schema';
import { HclModelTree, HclModelTreeDocument } from './schemas/hcl-model-tree.schema';

@Injectable()
export class HclService {
  constructor(
      @InjectModel(HclModel.name) private hclModel: Model<HclModelDocument>,
      @InjectModel(GlobalParameter.name) private globalParameterModel: Model<GlobalParameterDocument>,
      @InjectModel(HclModelTree.name) private hclModelTree: Model<HclModelTreeDocument>
  ) {}

  pagination(url: string, count: number, limit?: any, offset?: any) {
    let previous = null;
    let next = null;
    let regex = /\?limit=[A-Za-z0-9]+&offset=[A-Za-z0-9]+/i;

    let default_limit = 10;
    let default_offset = 0;
    if(!isNaN(limit)) { default_limit = limit };
    if(!isNaN(offset)) { default_offset = offset };

    let total_page = Math.ceil(count/default_limit);
    let current_page = (default_offset/default_limit) + 1;
    
    if(total_page === 1) {
      return { previous, next, default_limit, default_offset };
    } else if(current_page === 1 && total_page > 1) {
      if(url.includes('limit')) {
        next = url.replace(regex, `?limit=${default_limit}&offset=${default_offset - (-default_limit)}`);
        return { previous, next, default_limit, default_offset };
      } else {
        next = url + `?limit=${default_limit}&offset=${default_offset - (-default_limit)}`;
        return { previous, next, default_limit, default_offset };
      }
    } else if(current_page === total_page && total_page > 1) {
      previous = url.replace(regex, `?limit=${default_limit}&offset=${default_offset - default_limit}`);
      return { previous, next, default_limit, default_offset };
    } else if(current_page > 1 && current_page < total_page) {
      previous = url.replace(regex, `?limit=${default_limit}&offset=${default_offset - default_limit}`);
      next = url.replace(regex, `?limit=${default_limit}&offset=${default_offset - (-default_limit)}`);
      return { previous, next, default_limit, default_offset };
    }
  }

  async getHclModelList(url: string, user_id: number, limit: any, offset: any) {
    const queryOptions = {
      'creator': { $eq: user_id }
    }
    const count = await this.hclModel.count(queryOptions);
    const paths = this.pagination(url, count, limit, offset);
    const result = await this.hclModel.find(queryOptions).skip(paths.default_offset).limit(paths.default_limit);
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }

  async createHclModel(user_id: number, body: HclModelDto) {
    const newHclModel = new this.hclModel(body);
    newHclModel.creator = user_id;
    newHclModel.tag = 'CO';
    newHclModel.type = 'hcl';
    return newHclModel.save();
  }

  async updateHclModel(model_id: string, body: Partial<HclModel>): Promise<HclModel> {
    const model_number = Number(model_id);
    return this.hclModel.findOneAndUpdate({ model_id: model_number }, body, { new: true });
  }

  async getGlobalParameterList(url: string, user_id: number, model_id: string, limit?: any, offset?: any): Promise<PaginationDto> {
    let paths = null;
    let result = null;
    const model_id_number = Number(model_id);
    const queryOptions = {
      'user_id': { $eq: user_id },
      'model_id': { $eq: model_id_number }
    };
    const count = await this.globalParameterModel.count(queryOptions);
    if(limit && offset) {
      paths = this.pagination(url, count, limit, offset);
      result = await this.globalParameterModel.find(queryOptions).skip(paths.default_offset).limit(paths.default_limit);
    } else {
      paths = this.pagination(url, count);
      result = await this.globalParameterModel.find(queryOptions);
    }
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }
  
  async createGlobalParameter(user_id: number, model_id: string, body: GlobalParameterDto): Promise<GlobalParameter> {
    if(body.double_value) {
      body.double_value = Number(body.double_value);
    }

    const newGlobalParameter = new this.globalParameterModel(body);
    newGlobalParameter.model_id = Number(model_id);
    newGlobalParameter.user_id = user_id;
    if(body.double_value) {
      newGlobalParameter.parameter_type = 'DO';
      newGlobalParameter.string_value = '';
    } else if(body.string_value) {
      newGlobalParameter.parameter_type = 'ST';
      newGlobalParameter.double_value = 0;
    }
    return newGlobalParameter.save();
  }

  async partialUpdateGlobalParameter(user_id: number, model_id: string, parameter_id: string, body: Partial<GlobalParameter>): Promise<GlobalParameter> {
    const model_id_number = Number(model_id);
    const global_parameter_id = Number(parameter_id);
    const queryOptions = {
      'user_id': { $eq: user_id },
      'model_id': { $eq: model_id_number },
      'pk': { $eq: global_parameter_id }
    };
    return this.globalParameterModel.findOneAndUpdate(queryOptions, body, { new: true });
  }

  async deleteGlobalParameter(user_id: number, model_id: string, parameter_id: string): Promise<any> {
    const model_id_number = Number(model_id);
    const global_parameter_id = Number(parameter_id);
    const queryOptions = {
      'user_id': { $eq: user_id },
      'model_id': { $eq: model_id_number },
      'pk': { $eq: global_parameter_id }
    };
    await this.globalParameterModel.findOneAndDelete(queryOptions);
    throw HttpStatus.NO_CONTENT;
  }
  
  async createHclModelTree(model_id: string, body: HclModelTreeDto): Promise<HclModelTree>{
    const newHclModelTree = new this.hclModelTree(body);
    newHclModelTree.model_id = model_id;
    newHclModelTree.model = {
      id: Number(model_id),
      type: 'hcl',
      model_tag: 'CO'
    };
    newHclModelTree.valid = false;
    return newHclModelTree.save();
  }
}