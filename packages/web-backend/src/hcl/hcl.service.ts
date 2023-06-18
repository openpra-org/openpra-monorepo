import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as dot from 'dot-object';
import { HclModelDto } from './dtos/hcl-model.dto';
import { GlobalParameterDto } from './dtos/global-parameter.dto';
import { HclModelTreeDto } from './dtos/hcl-model-tree.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { ModelCounter, ModelCounterDocument } from './schemas/model-counter.schema';
import { HclModel, HclModelDocument } from './schemas/hcl-model.schema';
import { Action, ActionDocument } from './schemas/action.schema';
import { GlobalParameterCounter, GlobalParameterCounterDocument } from './schemas/global-parameter-counter.schema';
import { GlobalParameter, GlobalParameterDocument } from './schemas/global-parameter.schema';
import { TreeCounter, TreeCounterDocument } from './schemas/tree-counter.schema';
import { HclModelTree, HclModelTreeDocument } from './schemas/hcl-model-tree.schema';
import { FaultTree, FaultTreeDocument } from './schemas/fault-tree.schema';
import { EventSequenceDiagram, EventSequenceDiagramDocument } from './schemas/event-sequence-diagram.schema';
import { BayesianNetworks, BayesianNetworksDocument } from './schemas/bayesian-networks.schema';
import { OverviewTree, OverviewTreeDocument } from './schemas/overview-tree.schema';
import { QuantificationResultCounter, QuantificationResultCounterDocument } from './schemas/quantification-result-counter.schema';
import { QuantificationResult, QuantificationResultDocument } from './schemas/quantification-result.schema';
import { User, UserDocument } from '../collab/schemas/user.schema';

@Injectable()
export class HclService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ModelCounter.name) private modelCounterModel: Model<ModelCounterDocument>,
    @InjectModel(TreeCounter.name) private treeCounterModel: Model<TreeCounterDocument>,
    @InjectModel(GlobalParameterCounter.name) private globalParameterCounterModel: Model<GlobalParameterCounterDocument>,
    @InjectModel(HclModel.name) private hclModel: Model<HclModelDocument>,
    @InjectModel(GlobalParameter.name) private globalParameterModel: Model<GlobalParameterDocument>,
    @InjectModel(Action.name) private actionModel: Model<ActionDocument>,
    @InjectModel(HclModelTree.name) private hclModelTree: Model<HclModelTreeDocument>,
    @InjectModel(FaultTree.name) private faultTreeModel: Model<FaultTreeDocument>,
    @InjectModel(EventSequenceDiagram.name) private eventSequenceDiagramModel: Model<EventSequenceDiagramDocument>,
    @InjectModel(BayesianNetworks.name) private bayesianNetworksModel: Model<BayesianNetworksDocument>,
    @InjectModel(OverviewTree.name) private overviewTreeModel: Model<OverviewTreeDocument>,
    @InjectModel(QuantificationResultCounter.name) private quantificationResultCounterModel: Model<QuantificationResultCounterDocument>,
    @InjectModel(QuantificationResult.name) private quantificationResultModel: Model<QuantificationResultDocument>
  ) {}

  async getNextModelValue(name: string) {
    var record = await this.modelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
        var newCounter = new this.modelCounterModel({ _id: name, seq: 1 });
        await newCounter.save();
        return newCounter.seq;
    }
    return record.seq;
  }

  async getNextGlobalParameterValue(name: string) {
    var record = await this.globalParameterCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
        var newCounter = new this.globalParameterCounterModel({ _id: name, seq: 1 });
        await newCounter.save();
        return newCounter.seq;
    }
    return record.seq;
  }

  async getNextTreeValue(name: string) {
    var record = await this.treeCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
        var newCounter = new this.treeCounterModel({ _id: name, seq: 1 });
        await newCounter.save();
        return newCounter.seq;
    }
    return record.seq;
  }

  async getNextQuantificationResultValue(name: string) {
    var record = await this.quantificationResultCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
      var newCounter = new this.quantificationResultCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  pagination(count: number, url: string, limit?: any, offset?: any) {
    let previous = null;
    let next = null;
    let regex = /limit=[A-Za-z0-9]+&offset=[A-Za-z0-9]+/i;

    let default_limit = 10;
    let default_offset = 0;
    if(limit && offset) {
      if(!isNaN(limit))
        { default_limit = Number(limit) };
      if(!isNaN(offset))
        { default_offset = Number(offset) };
    }

    let total_page = Math.ceil(count/default_limit);
    let current_page = (default_offset/default_limit) + 1;
    
    if(total_page <= 1) {
      return { previous, next, default_limit, default_offset };
    } else if(current_page === 1 && total_page > 1) {
      if(url.includes('limit')) {
        next = url.replace(regex, `limit=${default_limit}&offset=${default_offset - (-default_limit)}`);
        return { previous, next, default_limit, default_offset };
      } else {
          if(url.includes('?')) {
            next = url + `limit=${default_limit}&offset=${default_offset - (-default_limit)}`;
            return { previous, next, default_limit, default_offset };
          } else {
            next = url + `?limit=${default_limit}&offset=${default_offset - (-default_limit)}`;
            return { previous, next, default_limit, default_offset };
          }
      }
    } else if(current_page === total_page && total_page > 1) {
      previous = url.replace(regex, `limit=${default_limit}&offset=${default_offset - default_limit}`);
      return { previous, next, default_limit, default_offset };
    } else if(current_page > 1 && current_page < total_page) {
      previous = url.replace(regex, `limit=${default_limit}&offset=${default_offset - default_limit}`);
      next = url.replace(regex, `limit=${default_limit}&offset=${default_offset - (-default_limit)}`);
      return { previous, next, default_limit, default_offset };
    }
  }

  /**
  * Since we are only looking for fault trees, the tree_type is going to be 'f'. Event sequence diagrams and bayesian networks have their own tree_types
  * ('e' and 'b' respectively). The data are retrieved based on 4 scenarios:
  * 1. basic events and house events both are queried.
  * 2. only basic events is queried.
  * 3. only house events is queried.
  * 4. none of the events are queried.
  * Generally speaking, this URL is only used when case 1 is applicable. So, both the basic events and house events are always going to be true. The rest
  * of the 3 scenarios are there as 'edge cases'.
  */
  async getHclModelData(model_id: string, basic_events: string, house_events: string) {
    const queryOptions = {
      'model_id': Number(model_id),
      'tree_type': 'f'
    };
    if(basic_events === 'false' && house_events === 'false') {
      return this.hclModelTree.find(queryOptions, { 'tree_data': 1 });
    } else if(basic_events === 'true' && house_events === 'false') {
      return this.hclModelTree.find(queryOptions, { 'tree_data.basic_events': 1 });
    } else if(basic_events === 'false' && house_events === 'true') {
      return this.hclModelTree.find(queryOptions, { 'tree_data.house_events': 1 });
    } else if(basic_events === 'true' && house_events === 'true') { 
      return this.hclModelTree.find(queryOptions, { 'tree_data.basic_events': 1, 'tree_data.house_events': 1 });
    }
  }

  /**
  * To show the gates' data only, inside the projection parameter of hclModelTree.find() method the desired field is set to 1 (or true). 
  * Since the tree_data is a nested object, to show an object of tree_data (e.g. gates object) that object has to be added after the dot operator.
  */
  async getHclModelGatesData(model_id: string) {
    const queryOptions = {
      'model_id': Number(model_id),
      'tree_type': 'f'
    };
    return this.hclModelTree.find(queryOptions, { 'tree_data.gates': 1 });
  }
  
  /** 
  * The HCL Model list is retrieved considering 5 scenarios:
  *  1. tag, type, limit, and offset - all the 4 Query parameters are missing.
  *  2. Only the tag is provided.
  *  3. tag is provided along with limit and offset.
  *  4. Only the type is provided.
  *  5. type is provided along with limit and offset.
  */
  async getHclModelList(user_id: number, url: string, tag?: string, type?: string, limit?: any, offset?: any): Promise<PaginationDto> {
    let count = undefined;
    let paths = undefined;
    let result = undefined;
    let queryOptions = undefined;

    if(!tag && !type && !limit && !offset) {
      queryOptions = {
        'assigned_users': user_id
      };
      count = await this.hclModel.countDocuments(queryOptions);
      paths = this.pagination(count, url);
      result = await this.hclModel.find(queryOptions).limit(paths.default_limit);
    } else if(tag && !limit && !offset) {
      queryOptions = {
        'assigned_users': user_id,
        'tag': tag
      };
      count = await this.hclModel.countDocuments(queryOptions);
      paths = this.pagination(count, url);
      result = await this.hclModel.find(queryOptions).limit(paths.default_limit);
    } else if(tag && limit && offset) {
      queryOptions = {
        'assigned_users': user_id,
        'tag': tag
      };
      count = await this.hclModel.countDocuments(queryOptions);
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModel.find(queryOptions).skip(paths.default_offset).limit(paths.default_limit);
    } else if(type && !limit && !offset) {
      queryOptions = {
        'assigned_users': user_id,
        'type': type
      };
      count = await this.hclModel.countDocuments(queryOptions);
      paths = this.pagination(count, url);
      result = await this.hclModel.find(queryOptions).limit(paths.default_limit);
    } else if(type && limit && offset) {
      queryOptions = {
        'assigned_users': user_id,
        'type': type
      };
      count = await this.hclModel.countDocuments(queryOptions);
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModel.find(queryOptions).skip(paths.default_offset).limit(paths.default_limit);
    }

    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }

  /**
  * Aside from the provided data, a number of hard coded data are added with the newly created HCL Model before it is saved in the database:
  *  1. A unique Model ID is generated using the getNextModelValue() method.
  *  2. The current user is assigned as the 'creator' of the Model.
  *  3. Path is simply a URL through which the Model can be accessed. By joining the current URL ('https://staging.app.openpra.org/api/hcl/model/')
  *      with the Model ID, the path is created.
  *  4. Whenever a new HCL Model is created, a fault tree is created inside of it as well with some fixed data (title, description, tree_type, and tree_data).
  *  5. By default, this fault tree is set as the overview tree of this HCL Model. Whenever a user opens an HCL Model, the first thing they are going to
  *      see is the overview tree. Overview tree is the highlighted part of an HCL Model. If a user is currently working on a HCL Tree, they can set
  *      it as the overview tree so that whenever they open the HCL Model again they can quickly remember on which tree they were recently working on.
  *  6. The model_data contains the IDs of all the created fault trees, event sequence diagrams, bayesian networks, and initiating events inside that HCL Model.
  *  7. Since a fault tree is created, its actions (or activities) need to be tracked as well. By default the actions is set to 'v' (the user 'viewed' the tree).
  *      Other actions are available as well - for example: 'e' and 'q', meaning the user 'edited' the tree and 'quantified' the tree respectively.
  *  8. A whole copy of this complete HCL Model is saved inside the User document. After that the Model gets saved inside the database.
  */
  async createHclModel(user_id: number, username: string, body: HclModelDto, url: string): Promise<HclModel> {
    const newHclModel = new this.hclModel(body);
    newHclModel.id = await this.getNextModelValue('ModelCounter');
    newHclModel.creator = user_id;
    newHclModel.path = url + `${newHclModel.id}/`;

    let defaultTreeBody = {
      title: 'Overview',
      description: `Overview tree for ${body.title}`,
      tree_type: 'f',
      tree_data: {}
    };
    let defaultTree = await this.createDefaultOverviewTree(user_id, newHclModel.id, defaultTreeBody);

    newHclModel.overview_tree = defaultTree.id;
    await this.setOverviewTree(newHclModel.id, defaultTree.id);
    newHclModel.model_data = {
      bayesian_networks: [],
      event_trees: [],
      fault_trees: [newHclModel.overview_tree],
      init_events: []
    };

    let action = {
      tree_id: defaultTree.id,
      user: {
        id: user_id,
        username: username
      },
      type: 'v'
    };
    let newAction = new this.actionModel(action);
    newAction = await newAction.save();
    newHclModel.actions = [newAction];
    let savedHclModel = await newHclModel.save()

    let user = await this.userModel.findOne({ id: user_id }).lean();
    let userId = user._id;
    await this.userModel.findByIdAndUpdate(userId, { $push: { 'recently_accessed.models': savedHclModel } }, { upsert: false });

    return savedHclModel;
  }

  async createDefaultOverviewTree(user_id: number, model_id: number, body: HclModelTreeDto): Promise<HclModelTree> {
    let newHclModelTree = new this.faultTreeModel(body);
    newHclModelTree.model_id = model_id;
    newHclModelTree.id = await this.getNextTreeValue('TreeCounter');
    newHclModelTree.creator = user_id;
    newHclModelTree.model = {
      id: model_id,
      type: 'hcl',
      model_tag: 'CO'
    };
    let savedHclModelTree = await newHclModelTree.save();

    let tree_id = savedHclModelTree._id;
    let updateBody = {
      tree_name: 'FaultTree',
      tree_data: {
        basic_events: {},
        house_events: {},
        gates: {},
        components: {},
        model_tree_id: newHclModelTree.id,
        label: {
          name: body.title,
          description: body.description
        }
      }
    }

    return this.faultTreeModel.findByIdAndUpdate(tree_id, { $set: updateBody }, { new: true, upsert: false });
  }

  async setOverviewTree(model_id: number, tree_id: number) {
    const queryOptions = {
      'id': tree_id,
      'model_id': model_id
    };
    let hclTree = await this.hclModelTree.findOne(queryOptions);
    let hclTreeObject = hclTree.toObject({ flattenMaps: true });
    let { tree_data, ...properties } = hclTreeObject;
    let newHclTreeObject = { ...properties, ...tree_data };
    let overviewTreeObject = {
      overview_tree_id: tree_id,
      [tree_id]: newHclTreeObject
    };
    let newOverviewTree = new this.overviewTreeModel(overviewTreeObject);
    await newOverviewTree.save();
  }

  /**
  * The Model ID is provided as a Query filter. The current UserID is provided as a Query filter as well to check if the HclModel was assigned to the User.
  * It doesn't matter if the current user is the 'creator' of the HCL Model or not, what matters is whether the UserID is present in the assigned_users list.
  */
  async getHclModelById(user_id: number, model_id: string): Promise<HclModel> {
    return this.hclModel.findOne({ 'id': Number(model_id), 'assigned_users': user_id });
  }

  /**
  * Only 5 fields of the HCL Model can be updated:
  *  a) either the title, description, and assigned_users
  *  b) or else the tag
  *  c) or else the overview_tree
  * Since a copy of the HCL Model is kept inside the User document, each time we update the HCL Model we have to update the User document as well. The HCL
  * Model is saved as a nested object inside the User document. Nested objects should always be updated using the dot operator. In case of scenario (a),
  * instead of updating the 3 properties manually inside the User document, the map() method is used to iterate over the request body and update the User 
  * document accordingly.
  */
  async updateHclModelById(user_id: number, model_id: string, body) {
    let userModelUpdateBody = {'recently_accessed.models.$.date_modified': Date.now()};
    if(body.tag) {
      userModelUpdateBody['recently_accessed.models.$.tag'] = body.tag;
      await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $set: userModelUpdateBody }, { upsert: false });
    } else if(body.overview_tree) {
      userModelUpdateBody['recently_accessed.models.$.overview_tree'] = body.overview_tree;
      await this.setOverviewTree(Number(model_id), body.overview_tree);
      await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $set: userModelUpdateBody }, { upsert: false });
    } else {
      Object.keys(body).map(key => {
        userModelUpdateBody[`recently_accessed.models.$.${key}`] = body[key];
      });
      await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $set: userModelUpdateBody }, { upsert: false });
    }

    const queryOptions = {
      'id': Number(model_id),
      'creator': user_id
    };
    let hclModel = await this.hclModel.findOne(queryOptions).lean();
    let id = hclModel._id;
    return this.hclModel.findByIdAndUpdate(id, { $set: body }, { new: true, upsert: false });
  }

  /**
  * 1. An HCL Model contains:
  *   a. Fault trees, Event sequence diagrams, and Bayesian networks.
  *   b. Global parameters.
  *   c. Quantification history.
  * The HCL Model and all of these associated data are removed from the database.
  * 2. Besides that, the 'OverviewTree' and 'Action' documents that are carrying the data of the HCL trees related to this HCL Model are deleted.
  * 3. Finally, some of the data related to the HCL Model still persists in the 'User' document, so that portion of data needs to be removed as well.
  */
  async deleteHclModelById(user_id: number, model_id: string): Promise<HttpStatus> {
    let hclModelTrees = await this.hclModelTree.find({ model_id: Number(model_id) }).lean();
    if(hclModelTrees) {
      hclModelTrees.map(async tree => {
        let treeId = tree.id;
        await this.hclModelTree.findOneAndDelete({ id: treeId });
        await this.actionModel.findOneAndDelete({ tree_id: treeId });
        await this.overviewTreeModel.findOneAndDelete({ overview_tree_id: treeId });
      });
    }
    
    await this.globalParameterModel.deleteMany({ model_id: Number(model_id) });
    await this.quantificationResultModel.deleteMany({ model: Number(model_id) });
    await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $pull: { 'recently_accessed.models': { 'id': Number(model_id) } } });
    
    await this.hclModel.findOneAndDelete({ 'id': Number(model_id), 'assigned_users': user_id });
    return HttpStatus.NO_CONTENT;
  }

  async createCopyHclModel(user_id: number, overviewTreeId: number, body: HclModelDto, url: string): Promise<HclModel> {
    const newHclModel = new this.hclModel(body);
    newHclModel.id = await this.getNextModelValue('ModelCounter');
    newHclModel.creator = user_id;
    newHclModel.path = url + `${newHclModel.id}/`;
    newHclModel.overview_tree = overviewTreeId;
    let savedHclModel = await newHclModel.save()

    let user = await this.userModel.findOne({ id: user_id }).lean();
    let userId = user._id;
    await this.userModel.findByIdAndUpdate(userId, { $push: { 'recently_accessed.models': savedHclModel } }, { upsert: false });
    return savedHclModel;
  }
  
  /**
  * 1. Creating a new HCL Model is a bit complex since there are a number of hard-coded data involved with the process. So instead of creating the new copied HCL
  *    Model from scratch, the data related to the new Model is passed to the already existing createHclModel() method. The current url contains the 'copy' keyword
  *    which is undesirable, so using Regex the 'copy' keyword is replaced by an empty string.
  * 2. 
  */
  async copyHclModelById(user_id: number, model_id: string | number, username: string, body: HclModelDto, url: string) {
    let regex = /[0-9]+\/copy\//i;
    let newUrl = url.replace(regex, '');
    let modelQueryOptions = {
      'id': Number(model_id),
      'assigned_users': user_id
    };
    let hclModel = await this.hclModel.findOne(modelQueryOptions).lean();
    let overviewTreeId = hclModel.overview_tree;
    let hclModelCopy = await this.createCopyHclModel(user_id, overviewTreeId, body, newUrl);
    let hclModelCopyId = hclModelCopy.id;

    let treeQueryOptions = {
      'model_id': Number(model_id)
    };
    let hclModelTrees = await this.hclModelTree.find(treeQueryOptions);
    
    hclModelTrees.map(async tree => {
      let isOverviewTree = false;
      if(tree.id === overviewTreeId) {
        isOverviewTree = true;
      } else {
        isOverviewTree = false;
      }
      let treeObject = tree.toObject({ flattenMaps: true });
      let { title, description, tree_type, tree_data } = treeObject;
      let treeBody = {
        title: title,
        description: description,
        tree_type: tree_type,
        tree_data: {}
      }
      if(tree_type === 'f') {
        let faultTree = await this.createFaultTreeByModelId(user_id, username, hclModelCopyId, treeBody);
        let faultTreeId = faultTree._id;
        let treeId = faultTree.id;
        let updateBody = { 
          tree_name: 'FaultTree',
          tree_data: tree_data
        };
        await this.faultTreeModel.findByIdAndUpdate(faultTreeId, { $set: updateBody }, { new: true, upsert: false });
        if(isOverviewTree) {
          await this.setOverviewTree(hclModelCopyId, treeId);
        }
      } else if(tree_type === 'e') {
        let eventSequenceDiagram = await this.createEventSequenceDiagramByModelId(user_id, username, hclModelCopyId, treeBody);
        let eventSequenceDiagramId = eventSequenceDiagram._id;
        let treeId = eventSequenceDiagram.id;
        let updateBody = { 
          tree_name: 'EventSequenceDiagram',
          tree_data: tree_data
        };
        await this.eventSequenceDiagramModel.findByIdAndUpdate(eventSequenceDiagramId, { $set: updateBody }, { new: true, upsert: false });
        if(isOverviewTree) {
          await this.setOverviewTree(hclModelCopyId, treeId);
        }
      } else if(tree_type === 'b') {
        let bayesianNetworks = await this.createBayesianNetworksByModelId(user_id, username, hclModelCopyId, treeBody);
        let bayesianNetworksId = bayesianNetworks._id;
        let treeId = bayesianNetworks.id;
        let updateBody = { 
          tree_name: 'BayesianNetworks',
          tree_data: tree_data
        };
        await this.bayesianNetworksModel.findByIdAndUpdate(bayesianNetworksId, { $set: updateBody }, { new: true, upsert: false });
        if(isOverviewTree) {
          await this.setOverviewTree(hclModelCopyId, treeId);
        }
      }
    });

    return hclModelCopy;
  }

  /** The information is extracted from the OverviewTree document using the 'overview_tree' property of the HCL Model document. */
  async getHclModelOverviewTreeByModelId(user_id: number, model_id: string): Promise<OverviewTree> {
    const queryOptions = {
      'id': Number(model_id),
      'assigned_users': user_id,
    };
    let HclModel = await this.hclModel.findOne(queryOptions).lean();
    let OverviewTreeId = HclModel.overview_tree;
    return this.overviewTreeModel.findOne({ overview_tree_id: OverviewTreeId }).lean();
  }

  /**
  * The list of global parameters is extracted from the GlobalParameter document using the provided Model ID.
  * If the current user sets a limit and offset then the results are shown within these bounds. However, even if the user doesn't set any limit or offset,
  * the default limit (10) is always going to be applied to the results meaning the user will see 10 results at max.
  */
  async getGlobalParameterListByModelId(model_id: string, url: string, limit?: any, offset?: any): Promise<PaginationDto> {
    let paths = undefined;
    let result = undefined;
    const queryOptions = {
      'model_id': Number(model_id)
    };
    const count = await this.globalParameterModel.countDocuments(queryOptions);
    if(limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = await this.globalParameterModel.find(queryOptions).lean().skip(paths.default_offset).limit(paths.default_limit);
    } else {
      paths = this.pagination(count, url);
      result = await this.globalParameterModel.find(queryOptions).lean().limit(paths.default_limit);
    }
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }
  
  /** 
  * Right now the global parameters are only able to store double data types; although string values can be saved as global parameters as well.
  * But in reality string values are not going to be stored for the time being. The 'double_value' is stored as a string so it needs to be converted to number.
  * Global parameters have 'pk' instead of an 'ID'. The 'model_id' is an additional property of GlobalParameter document that makes performing queries a bit easier.
  */
  async createGlobalParameterByModelId(model_id: string, body: GlobalParameterDto): Promise<GlobalParameter> {
    if(body.double_value) {
      body.double_value = Number(body.double_value);
    }
    const newGlobalParameter = new this.globalParameterModel(body);
    newGlobalParameter.model_id = Number(model_id);
    newGlobalParameter.pk = await this.getNextGlobalParameterValue('GlobalParameterCounter');
    if(body.double_value) {
      newGlobalParameter.parameter_type = 'DO';
      newGlobalParameter.string_value = '';
    } else if(body.string_value) {
      newGlobalParameter.parameter_type = 'ST';
      newGlobalParameter.double_value = 0;
    }
    return newGlobalParameter.save();
  }

  /**
  * Normally either the parameter name or the double value is updated. The 'Partial' type indicates that all the properties of GlobalParameter schema is optional.
  * The user might update all the properties of the global parameter or they might update none. Either way the web-app is not going to show any error.
  */
  async partialUpdateGlobalParameterByModelAndParameterId(model_id: string, parameter_id: string, body: Partial<GlobalParameter>): Promise<GlobalParameter> {
    const queryOptions = {
      'pk': Number(parameter_id),
      'model_id': Number(model_id)
    };
    let globalParameter = await this.globalParameterModel.findOne(queryOptions).lean();
    let globalParameterId = globalParameter._id;
    return this.globalParameterModel.findByIdAndUpdate(globalParameterId, body, { new: true });
  }

  /** After the global parameter is deleted from the database, a 204 status is thrown which translates to: there is 'no content' to send in the response body. */
  async deleteGlobalParameterByModelAndParameterId(model_id: string, parameter_id: string): Promise<HttpStatus> {
    const queryOptions = {
      'pk': Number(parameter_id),
      'model_id': Number(model_id)
    };
    await this.globalParameterModel.findOneAndDelete(queryOptions);
    return HttpStatus.NO_CONTENT;
  }

  async getHclModelQuantificationListById(model_id: string, url: string, limit?: string, offset?: string) {
    let paths = undefined;
    let result = undefined;
    const queryOptions = {
      'model': Number(model_id)
    };
    const count = await this.quantificationResultModel.countDocuments(queryOptions);
    if(limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = await this.quantificationResultModel.find(queryOptions).lean().skip(paths.default_offset).limit(paths.default_limit);
    } else {
      paths = this.pagination(count, url);
      result = await this.quantificationResultModel.find(queryOptions).lean().limit(paths.default_limit);
    }
    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }
  
  async hclModelQuantificationById(user_id: number, model_id: string, body, url: string) {
    if(!body.configuration.constructor.replace_transfer_gates_with_basic_events) {
      body.configuration.constructor.replace_transfer_gates_with_basic_events = false;
    }
    let hclModel = await this.hclModel.findOne({ 'creator': user_id, 'id': Number(model_id) }).lean();
    let newHclModelQuantificationResult = new this.quantificationResultModel(body);
    newHclModelQuantificationResult.id = await this.getNextQuantificationResultValue('QuantificationResultCounter');
    newHclModelQuantificationResult.creator = user_id;
    newHclModelQuantificationResult.model = Number(model_id);
    newHclModelQuantificationResult.model_title = hclModel.title;
    let result = `${url}${newHclModelQuantificationResult.id}/`;

    let hclModelTreeId = body.configuration.constructor.tree_id;
    let hclModelTreeAction = await this.actionModel.findOne({ tree_id: hclModelTreeId }).lean();
    let hclModelTreeActionId = hclModelTreeAction._id;
    await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'q' });
    await this.hclModel.updateOne({ 'actions.tree_id': hclModelTreeId }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'q' }, $push: { 'results': result } });
    await this.userModel.updateOne(
      { 'recently_accessed.models.actions.tree_id': hclModelTreeId },
      { $set:
        { 
          'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
          'recently_accessed.models.$[outer].actions.$[inner].type': 'q' 
        } 
      },
      { 'arrayFilters': [{ 'outer.creator': user_id }, { 'inner.tree_id': hclModelTreeId }], upsert: false }
    )

    return newHclModelQuantificationResult.save();
  }

  /**
  * The results are queried based on 4 scenarios:
  *  1. if the type of the trees is provided but there's no user defined limit or offset
  *  2. if the type of the trees is not provided but there are user defined limit and offset
  *  3. if the type of the trees is provided along with user defined limit and offset
  *  4. if neither the type of the trees nor any limit or offset have been provided
  */
  async getHclModelTreeListByModelId(model_id: string, url: string, type?: any, limit?: any, offset?: any): Promise<PaginationDto> {
    let count = null;
    let paths = null;
    let result = null;
    let queryOptions = {};

    if(type && !limit && !offset) {
      queryOptions = {
        'model_id': Number(model_id),
        'tree_type': type
      };
      count = await this.hclModelTree.countDocuments(queryOptions);
      paths = this.pagination(count, url);
      result = await this.hclModelTree.find(queryOptions).lean().limit(paths.default_limit);
    } else if(!type && limit && offset) {
      queryOptions = {
        'model_id': Number(model_id)
      };
      count = await this.hclModelTree.countDocuments(queryOptions);
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModelTree.find(queryOptions).lean().skip(paths.default_offset).limit(paths.default_limit);
    } else if(type && limit && offset) {
      queryOptions = {
        'model_id': Number(model_id),
        'tree_type': type
      };
      count = await this.hclModelTree.countDocuments(queryOptions);
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModelTree.find(queryOptions).lean().skip(paths.default_offset).limit(paths.default_limit);
    } else {
      queryOptions = {
        'model_id': Number(model_id)
      };
      count = await this.hclModelTree.countDocuments(queryOptions);
      paths = this.pagination(count, url);
      result = await this.hclModelTree.find(queryOptions).lean().limit(paths.default_limit);
    }
    return {
      count: count, 
      next: paths.next,
      previous: paths.previous,
      results: result 
    }
  }

  /**
  * Additional hard-coded data are added with the newly created FaultTree entity before it is saved inside the database:
  *  1. Data related to the Model under which the tree is created are saved inside the 'Model' object. By default the type and tag are set to 'HCL' and 'CO' (component).
  *  2. After saving the tree in the database, an Action document has to be created for recording the activities of the user and their interactions with the tree.
  *  3. This action object has to be added in the HCL Model and the User document as well. While saving the action inside the HCL Model the newly created tree's ID is also added.
  *  4. Later, the tree is updated with some pre-set data. These pre-set data are not added at the beginning of this whole process is because it is much more easier
  *     to add nested objects as updates in the document rather than adding them while creating the tree.
  *  5. While adding these pre-set data the 'tree_name' property has to be passed. 'tree_name' is not an original property of HCL Model trees - rather this property
  *     is used as 'discriminator' key. To see examples about discriminators visit: https://docs.nestjs.com/techniques/mongodb#discriminators
  */
  async createFaultTreeByModelId(user_id: number, username: string, model_id: string | number, body: HclModelTreeDto) {
    let newFaultTree = new this.faultTreeModel(body);
    newFaultTree.model_id = Number(model_id);
    newFaultTree.id = await this.getNextTreeValue('TreeCounter');
    newFaultTree.creator = user_id;
    newFaultTree.model = {
      id: Number(model_id),
      type: 'hcl',
      model_tag: 'CO'
    };
    let savedFaultTree = await newFaultTree.save();

    let action = {
      tree_id: newFaultTree.id,
      user: {
        id: user_id,
        username: username
      },
      type: 'v'
    };
    let newAction = new this.actionModel(action);
    let savedAction = await newAction.save();

    const queryOptions = {
      'assigned_users': user_id,
      'id': Number(model_id)
    };
    let hclModel = await this.hclModel.findOne(queryOptions).lean();
    let hclModelId = hclModel._id;
    await this.hclModel.findByIdAndUpdate(hclModelId, { $push: { 'actions': savedAction, 'model_data.fault_trees': newFaultTree.id } });
    await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $push: { 'recently_accessed.models.$.actions': savedAction } }, { upsert: false });
    
    let tree_id = savedFaultTree._id;
    let updateBody = {
      tree_name: 'FaultTree',
      tree_data: {
        basic_events: {},
        house_events: {},
        gates: {},
        components: {},
        model_tree_id: newFaultTree.id,
        label: {
          name: body.title,
          description: body.description
        }
      }
    }

    return this.faultTreeModel.findByIdAndUpdate(tree_id, { $set: updateBody }, { new: true, upsert: false });
  }

  /** 
  * Additional hard-coded data are added with the newly created EventSequenceDiagram entity before it is saved inside the database:
  *  1. Data related to the Model under which the tree is created are saved inside the 'Model' object. By default the type and tag are set to 'HCL' and 'CO' (component).
  *  2. After saving the tree in the database, an Action document has to be created for recording the activities of the user and their interactions with the tree.
  *  3. This action object has to be added in the HCL Model and the User document as well. While saving the action inside the HCL Model the newly created tree's ID is also added.
  *  4. Later, the tree is updated with some pre-set data. These pre-set data are not added at the beginning of this whole process is because it is much more easier
  *     to add nested objects as updates in the document rather than adding them while creating the tree.
  *  5. While adding these pre-set data the 'tree_name' property has to be passed. 'tree_name' is not an original property of HCL Model trees - rather this property
  *     is used as 'discriminator' key. To see examples about discriminators visit: https://docs.nestjs.com/techniques/mongodb#discriminators
  */
  async createEventSequenceDiagramByModelId(user_id: number, username: string, model_id: string | number, body: HclModelTreeDto) {
    let newEventSequenceDiagram = new this.eventSequenceDiagramModel(body);
    newEventSequenceDiagram.model_id = Number(model_id);
    newEventSequenceDiagram.id = await this.getNextTreeValue('TreeCounter');
    newEventSequenceDiagram.creator = user_id;
    newEventSequenceDiagram.model = {
      id: Number(model_id),
      type: 'hcl',
      model_tag: 'CO'
    };
    let savedEventSequenceDiagram = await newEventSequenceDiagram.save();

    let action = {
      tree_id: newEventSequenceDiagram.id,
      user: {
        id: user_id,
        username: username
      },
      type: 'v'
    };
    let newAction = new this.actionModel(action);
    let savedAction = await newAction.save();

    const queryOptions = {
      'assigned_users': user_id,
      'id': Number(model_id)
    };
    let hclModel = await this.hclModel.findOne(queryOptions).lean();
    let hclModelId = hclModel._id;
    await this.hclModel.findByIdAndUpdate(hclModelId, { $push: { 'actions': savedAction, 'model_data.event_trees': newEventSequenceDiagram.id } });
    await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $push: { 'recently_accessed.models.$.actions': savedAction } }, { upsert: false });

    let tree_id = savedEventSequenceDiagram._id;
    let updateBody = {
      tree_name: 'EventSequenceDiagram',
      tree_data: {
        functional_events: {},
        sequences: {},
        branches: {},
        initial_state: {
          style: {
            position: {
              x: 0.0,
              y: 0.0
            }
          },
          label: {
            name: body.title,
            description: body.description
          }
        },
        model_tree_id: newEventSequenceDiagram.id,
        label: {
          name: body.title,
          description: body.description
        }
      }
    }

    return this.eventSequenceDiagramModel.findByIdAndUpdate(tree_id, { $set: updateBody }, { new: true, upsert: false });
  }

  /*
  * Additional hard-coded data are added with the newly created BayesianNetworks entity before it is saved inside the database:
  *  1. Data related to the Model under which the tree is created are saved inside the 'Model' object. By default the type and tag are set to 'HCL' and 'CO' (component).
  *  2. After saving the tree in the database, an Action document has to be created for recording the activities of the user and their interactions with the tree.
  *  3. This action object has to be added in the HCL Model and the User document as well. While saving the action inside the HCL Model the newly created tree's ID is also added.
  *  4. Later, the tree is updated with some pre-set data. These pre-set data are not added at the beginning of this whole process is because it is much more easier
  *     to add nested objects as updates in the document rather than adding them while creating the tree.
  *  5. While adding these pre-set data the 'tree_name' property has to be passed. 'tree_name' is not an original property of HCL Model trees - rather this property
  *     is used as 'discriminator' key. To see examples about discriminators visit: https://docs.nestjs.com/techniques/mongodb#discriminators
  */
  async createBayesianNetworksByModelId(user_id: number, username: string, model_id: string | number, body: HclModelTreeDto) {
    let newBayesianNetworks = new this.bayesianNetworksModel(body);
    newBayesianNetworks.model_id = Number(model_id);
    newBayesianNetworks.id = await this.getNextTreeValue('TreeCounter');
    newBayesianNetworks.creator = user_id;
    newBayesianNetworks.model = {
      id: Number(model_id),
      type: 'hcl',
      model_tag: 'CO'
    };
    let savedBayesianNetworks = await newBayesianNetworks.save();

    let action = {
      tree_id: newBayesianNetworks.id,
      user: {
        id: user_id,
        username: username
      },
      type: 'v'
    };
    let newAction = new this.actionModel(action);
    let savedAction = await newAction.save();

    const queryOptions = {
      'assigned_users': user_id,
      'id': Number(model_id)
    };
    let hclModel = await this.hclModel.findOne(queryOptions).lean();
    let hclModelId = hclModel._id;
    await this.hclModel.findByIdAndUpdate(hclModelId, { $push: { 'actions': savedAction, 'model_data.bayesian_networks': newBayesianNetworks.id } });
    await this.userModel.updateOne({ 'recently_accessed.models.id': Number(model_id) }, { $push: { 'recently_accessed.models.$.actions': savedAction } }, { upsert: false });
    
    let tree_id = savedBayesianNetworks._id;
    let updateBody = {
      tree_name: 'BayesianNetworks',
      tree_data: {
        bayesian_nodes: {},
        model_tree_id: newBayesianNetworks.id,
        label: {
          name: body.title,
          description: body.description
        }
      }
    }

    return this.bayesianNetworksModel.findByIdAndUpdate(tree_id, { $set: updateBody }, { new: true, upsert: false });
  }

  /**
  * 2 scenarios are considered while retrieving the data:
  *  1. no limit or offset are set
  *  2. limit and offset are set
  */
  async getHclTreeList(url: string, limit?: any, offset?: any) {
    let paths = null;
    let result = null;
    let count = await this.hclModelTree.countDocuments();

    if(limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModelTree.find().lean().skip(paths.default_offset).limit(paths.default_limit);
    } else {
      paths = this.pagination(count, url);
      result = await this.hclModelTree.find().lean().limit(paths.default_limit);
    }

    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }

  /**
  * 1. By default the 
  */
  async getHclTreeById(user_id: number, tree_id: string, include_tree_data?: string): Promise<HclModelTree> {
    let hclModelTreeAction = await this.actionModel.findOne({ tree_id: Number(tree_id) }).lean();
    let hclModelTreeActionId = hclModelTreeAction._id;
    if(include_tree_data) {
      await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'v' });
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'v' } });
      await this.userModel.updateOne(
        { 'recently_accessed.models.actions.tree_id': Number(tree_id) },
        { $set: 
          { 
            'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
            'recently_accessed.models.$[outer].actions.$[inner].type': 'v'
          }
        },
        { 'arrayFilters': [{ 'outer.assigned_users': user_id }, { 'inner.tree_id': Number(tree_id) }], upsert: false }
      );
      return this.hclModelTree.findOne({ 'id': Number(tree_id) });
    } else {
      await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'v' });
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'v' } });
      await this.userModel.updateOne(
        { 'recently_accessed.models.actions.tree_id': Number(tree_id) },
        { $set:
          {
            'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
            'recently_accessed.models.$[outer].actions.$[inner].type': 'v'
          }
        },
        { 'arrayFilters': [{ 'outer.assigned_users': user_id }, { 'inner.tree_id': Number(tree_id) }], upsert: false }
      );
      return this.hclModelTree.findOne({ 'id': Number(tree_id) }).select('-tree_data');
    }
  }

  /**
  * After an HCL tree is updated, 4 other associated documents are updated as well:
  *  1. the Action document which contains the activity history of the tree.
  *  2. if the tree was set as an overview tree, then its associated info inside the OverviewTree document is updated.
  *  3. HCL Model document is updated since it has the 'actions' object that carries the interaction history of the tree.
  *  4. the User document is updated since it also carries information about the tree.
  */
  async updateHclTreeById(user_id: number, tree_id: string, body) {
    let overviewTree = await this.overviewTreeModel.findOne({ 'overview_tree_id': Number(tree_id) }).lean();
    if(overviewTree) {
      let overviewTreeId = overviewTree._id;
      let { tree_data } = body;
      let updateBody = {
        [Number(tree_id)]: tree_data
      };
      await this.overviewTreeModel.findByIdAndUpdate(overviewTreeId, { $set: dot.dot(updateBody) }, { new: true, upsert: false });
    }

    let hclTree = await this.hclModelTree.findOne({ 'id': Number(tree_id) }).lean();
    let hclTreeId = hclTree._id;
    let hclModelTreeAction = await this.actionModel.findOne({ tree_id: Number(tree_id) }).lean();
    let hclModelTreeActionId = hclModelTreeAction._id;
    if(body.tree_type === 'f') {
      body.tree_name = 'FaultTree';
      body = dot.dot(body);
      await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'e' });
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'e' } });
      await this.userModel.updateOne(
        { 'recently_accessed.models.actions.tree_id': Number(tree_id) },
        { $set: 
          { 
            'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
            'recently_accessed.models.$[outer].actions.$[inner].type': 'e' 
          } 
        },
        { 'arrayFilters': [{ 'outer.creator': user_id }, { 'inner.tree_id': Number(tree_id) }], upsert: false }
      );
      return this.faultTreeModel.findByIdAndUpdate(hclTreeId, { $set: body }, { new: true, upsert: false });
    } else if(body.tree_type === 'e') {
      body.tree_name = 'EventSequenceDiagram';
      body = dot.dot(body);
      await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'e' });
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'e' } });
      await this.userModel.updateOne(
        { 'recently_accessed.models.actions.tree_id': Number(tree_id) },
        { $set: 
          { 
            'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
            'recently_accessed.models.$[outer].actions.$[inner].type': 'e'
          } 
        },
        { 'arrayFilters': [{ 'outer.creator': user_id }, { 'inner.tree_id': Number(tree_id) }], upsert: false }
      );
      return this.eventSequenceDiagramModel.findByIdAndUpdate(hclTreeId, { $set: body }, { new: true, upsert: false });
    } else if(body.tree_type === 'b') {
      body.tree_name = 'BayesianNetworks';
      body = dot.dot(body);
      await this.actionModel.findByIdAndUpdate(hclModelTreeActionId, { type: 'e' });
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $set: { 'actions.$.date': Date.now(), 'actions.$.type': 'e' } });
      await this.userModel.updateOne(
        { 'recently_accessed.models.actions.tree_id': Number(tree_id) },
        { $set: 
          { 
            'recently_accessed.models.$[outer].actions.$[inner].date': Date.now(),
            'recently_accessed.models.$[outer].actions.$[inner].type': 'e' 
          } 
        },
        { 'arrayFilters': [{ 'outer.creator': user_id }, { 'inner.tree_id': Number(tree_id) }], upsert: false }
      );
      return this.bayesianNetworksModel.findByIdAndUpdate(hclTreeId, { $set: body }, { new: true, upsert: false });
    }
  }

  /**
  * After an HCL tree is deleted:
  *  1. its associated action and overview tree need to be deleted from Action document and OverviewTree document as well.
  *  2. its associated quantification history needs to be deleted from the QuantificationResult document.
  *  3. its activity record from the HclModel document needs to removed.
  *  4. its activity record from the User document needs to removed.
  * After everything related to the HCL tree are deleted, a 204 response status will be sent back to the user.
  */
  async deleteHclTreeById(tree_id: string): Promise<HttpStatus> {
    let hclTreeType = (await this.hclModelTree.findOne({ 'id': Number(tree_id) }).lean()).tree_type;
    
    await this.hclModelTree.findOneAndDelete({ 'id': Number(tree_id) });
    await this.actionModel.findOneAndDelete({ 'tree_id': Number(tree_id) });
    await this.overviewTreeModel.findOneAndDelete({ 'overview_tree_id': Number(tree_id) });
    await this.quantificationResultModel.deleteMany({ 'configuration.constructor.tree_id': Number(tree_id) });

    if(hclTreeType === 'f') {
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $pull: { 'actions': { 'tree_id': Number(tree_id) }, 'model_data.fault_trees': Number(tree_id) } }, { upsert: false });
    } else if(hclTreeType === 'e') {
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $pull: { 'actions': { 'tree_id': Number(tree_id) }, 'model_data.event_trees': Number(tree_id) } }, { upsert: false });
    } else if(hclTreeType === 'b') {
      await this.hclModel.updateOne({ 'actions.tree_id': Number(tree_id) }, { $pull: { 'actions': { 'tree_id': Number(tree_id) }, 'model_data.bayesian_networks': Number(tree_id) } }, { upsert: false });
    }
    
    await this.userModel.updateOne({ 'recently_accessed.models.actions.tree_id': Number(tree_id) }, { $pull: { 'recently_accessed.models.$[].actions': { 'tree_id': Number(tree_id) } } });
    return HttpStatus.NO_CONTENT;
  }

  async copyHclTreeById(user_id: number, username: string, tree_id: string | number) {
    const queryOptions = {
      'creator': user_id,
      'id': Number(tree_id)
    };
    let hclTree = await this.hclModelTree.findOne(queryOptions);
    let hclTreeObject = hclTree.toObject({ flattenMaps: true });
    let { model_id, title, description, tree_type, tree_data } = hclTreeObject;
    
    let hclTreeBody = {
      title: title,
      description: description,
      tree_type: tree_type,
      tree_data: {}
    };

    if(tree_type === 'f') {
      let updateBody = {
        tree_name: 'FaultTree',
        tree_data: tree_data
      };
      let faultTree = await this.createFaultTreeByModelId(user_id, username, model_id, hclTreeBody);
      let id = faultTree._id;
      return this.faultTreeModel.findByIdAndUpdate(id, { $set: updateBody }, { new: true, upsert: false });
    } else if(tree_type === 'e') {
      let updateBody = {
        tree_name: 'EventSequenceDiagram',
        tree_data: tree_data
      };
      let eventSequenceDiagram = await this.createEventSequenceDiagramByModelId(user_id, username, model_id, hclTreeBody);
      let id = eventSequenceDiagram._id;
      return this.eventSequenceDiagramModel.findByIdAndUpdate(id, { $set: updateBody }, { new: true, upsert: false });
    } else if(tree_type === 'b') {
      let updateBody = {
        tree_name: 'BayesianNetworks',
        tree_data: tree_data
      };
      let bayesianNetworks = await this.createBayesianNetworksByModelId(user_id, username, model_id, hclTreeBody);
      let id = bayesianNetworks._id;
      return this.bayesianNetworksModel.findByIdAndUpdate(id, { $set: updateBody }, { new: true, upsert: false });
    }
  }

  async copyHclTreeByIdWithLinkedTrees(user_id: number, username: string, tree_id: string) {
    const queryOptions = {
      'creator': user_id,
      'id': Number(tree_id)
    };
    let hclTree = await this.hclModelTree.findOne(queryOptions);
    let hclTreeObject = hclTree.toObject({ flattenMaps: true });
    let { model_id, title, description, tree_type, tree_data } = hclTreeObject;

    let hclTreeBody = {
      title: title,
      description: description,
      tree_type: tree_type,
      tree_data: {}
    };
    
    if(tree_type === 'f') {
      let gatesObj = tree_data.gates;
      let linkedTreeIds = [];
      Object.keys(gatesObj).forEach(key => {
        if(gatesObj[key].label.name === 'Transfer Gate' || gatesObj[key].label.name === 'Instance Transfer Gate') {
          linkedTreeIds.push(gatesObj[key].formula.tree_id);
        }
      })
      linkedTreeIds.map(async treeId => {
        await this.copyHclTreeById(user_id, username, treeId);
      });
      
      let updateBody = {
        tree_name: 'FaultTree',
        tree_data: tree_data
      };
      let faultTree = await this.createFaultTreeByModelId(user_id, username, model_id, hclTreeBody);
      let id = faultTree._id;
      return this.faultTreeModel.findByIdAndUpdate(id, { $set: updateBody }, { new: true, upsert: false });
    }
  }

  /**
  * 1. The current user has to be on the assigned_users list of the HCL Models that are being searched.
  * 2. The Models must match the provided type (in this case the Model type is HCL).
  * 3. The provided keyword is matched with the 'title' of the Models. To match this keyword the MongoDB database does a Regex (regular expression) search.
  *    The 'i' in the options stands for 'case insensitive'; meaning that both the provided keyword and the title of the Model will be converted to lowercase
  *    letter.
  */
  async searchHclModel(user_id: number, key: string, type: string, url: string, limit?:any, offset?:any) {
    let paths = undefined;
    let result = undefined;
    let queryOptions = {
      'assigned_users': user_id,
      'type': type,
      'title': { $regex: key, $options: 'i' }
    };
    let count = await this.hclModel.countDocuments(queryOptions);

    if(limit && offset) {
      paths = this.pagination(count, url, limit, offset);
      result = await this.hclModel.find(queryOptions).skip(paths.default_offset).limit(paths.default_limit);
    } else {
      paths = this.pagination(count, url);
      result = await this.hclModel.find(queryOptions).limit(paths.default_limit);
    }

    return {
      count: count,
      next: paths.next,
      previous: paths.previous,
      results: result
    }
  }
}