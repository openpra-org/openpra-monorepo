import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { InternalEventsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { InternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { FullScopeModel } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ExternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { InternalEvents, InternalEventsDocument } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "./schemas/full-scope.schema";
import { TypedModel, TypedModelJSON } from "./schemas/templateSchema/typed-model.schema";
@Injectable()
export class TypedModelService {
  constructor(
    @InjectModel(ModelCounter.name)
    private readonly modelCounterModel: Model<ModelCounterDocument>,
    @InjectModel(InternalEvents.name)
    private readonly internalEventsModel: Model<InternalEventsDocument>,
    @InjectModel(InternalHazards.name)
    private readonly internalHazardsModel: Model<InternalHazardsDocument>,
    @InjectModel(ExternalHazards.name)
    private readonly externalHazardsModel: Model<ExternalHazardsDocument>,
    @InjectModel(FullScope.name)
    private readonly fullScopeModel: Model<FullScopeDocument>,
  ) {}
  async getNextModelValue(name: string) {
    const record = await this.modelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.modelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }
  async createInternalEventModel(body: Partial<InternalEvents>): Promise<TypedModel> {
    const newInternalEvent = new this.internalEventsModel(body);
    newInternalEvent.id = await this.getNextModelValue("ModelCounter");
    return newInternalEvent.save();
  }
  async createInternalHazardModel(body: Partial<InternalHazards>): Promise<TypedModel> {
    const newInternalHazard = new this.internalHazardsModel(body);
    newInternalHazard.id = await this.getNextModelValue("ModelCounter");
    return newInternalHazard.save();
  }
  async createExternalHazardModel(body: Partial<ExternalHazards>): Promise<TypedModel> {
    const newExternalHazard = new this.externalHazardsModel(body);
    newExternalHazard.id = await this.getNextModelValue("ModelCounter");
    return newExternalHazard.save();
  }
  async createFullScopeModel(body: Partial<FullScope>): Promise<TypedModel> {
    const newFullScope = new this.fullScopeModel(body);
    newFullScope.id = await this.getNextModelValue("ModelCounter");
    return newFullScope.save();
  }
  async patchInternalEvent(modelId: string, userId: number, model: Partial<InternalEvents>): Promise<InternalEvents> {
    const query = { id: Number(modelId), users: userId };
    const newInternalEvent = new this.internalEventsModel(model);
    const updateData = {
      users: newInternalEvent.users,
      label: newInternalEvent.label,
    };
    const options = { new: true };
    return await this.internalEventsModel.findOneAndUpdate(query, updateData, options);
  }
  async patchInternalHazard(
    modelId: string,
    userId: number,
    model: Partial<InternalHazards>,
  ): Promise<InternalHazards> {
    const query = { id: Number(modelId), users: userId };
    const newInternalHazard = new this.internalHazardsModel(model);
    const updateData = {
      users: newInternalHazard.users,
      label: newInternalHazard.label,
    };
    const options = { new: true };
    return await this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async patchExternalHazard(
    modelId: string,
    userId: number,
    model: Partial<ExternalHazards>,
  ): Promise<ExternalHazards> {
    const query = { id: Number(modelId), users: userId };
    const newExternalHazard = new this.externalHazardsModel(model);
    const updateData = {
      users: newExternalHazard.users,
      label: newExternalHazard.label,
    };
    const options = { new: true };
    return await this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async patchFullScope(modelId: string, userId: number, model: Partial<FullScope>): Promise<FullScope> {
    const query = { id: Number(modelId), users: userId };
    const newFullScope = new this.fullScopeModel(model);
    const updateData = {
      users: newFullScope.users,
      label: newFullScope.label,
    };
    const options = { new: true };
    return await this.fullScopeModel.findOneAndUpdate(query, updateData, options);
  }
  async getInternalEvents(userId: number): Promise<InternalEvents[]> {
    return this.internalEventsModel.find({ users: userId });
  }
  async getInternalHazards(userId: number): Promise<InternalHazards[]> {
    return this.internalHazardsModel.find({ users: userId });
  }
  async getExternalHazards(userId: number): Promise<ExternalHazards[]> {
    return this.externalHazardsModel.find({ users: userId });
  }
  async getFullScopes(userId: number): Promise<FullScope[]> {
    return this.fullScopeModel.find({ users: userId });
  }
  async getInternalEvent(modelId: string, userId: number): Promise<InternalEvents> {
    return this.internalEventsModel.findOne({ id: modelId, users: userId });
  }
  async getInternalHazard(modelId: string, userId: number): Promise<InternalHazards> {
    return this.internalHazardsModel.findOne({ id: modelId, users: userId });
  }
  async getExternalHazard(modelId: string, userId: number): Promise<ExternalHazards> {
    return this.externalHazardsModel.findOne({ id: modelId, users: userId });
  }
  async getFullScope(modelId: string, userId: number): Promise<FullScope> {
    return this.fullScopeModel.findOne({ id: modelId, users: userId });
  }
  async deleteInternalEvent(modelId: number, userId: number): Promise<InternalEventsModel> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };
    const result = await this.internalEventsModel.findOne(query);
    if (result.users.length === 1) {
      return await this.internalEventsModel.findOneAndDelete(query);
    } else {
      return await this.internalEventsModel
        .findOneAndUpdate(query, updateData, { new: true })
        .lean<InternalEventsModel>();
    }
  }
  async deleteInternalHazard(modelId: number, userId: number): Promise<InternalHazardsModel> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };
    const result = await this.internalHazardsModel.findOne(query);
    if (result.users.length === 1) {
      return await this.internalHazardsModel.findOneAndDelete(query, {
        new: true,
      });
    } else {
      result.users = result.users.filter((user) => user !== userId);
      return await this.internalHazardsModel
        .findOneAndUpdate(query, updateData, { new: true })
        .lean<InternalHazardsModel>();
    }
  }
  async deleteExternalHazard(modelId: number, userId: number): Promise<ExternalHazardsModel> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };
    const result = await this.externalHazardsModel.findOne(query);
    if (result.users.length === 1) {
      return await this.externalHazardsModel.findOneAndDelete(query);
    } else {
      result.users = result.users.filter((user) => user !== userId);
      return await this.externalHazardsModel
        .findOneAndUpdate(query, updateData, { new: true })
        .lean<ExternalHazardsModel>();
    }
  }
  async deleteFullScope(modelId: number, userId: number): Promise<FullScopeModel> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };
    const result = await this.fullScopeModel.findOne(query);
    if (result.users.length === 1) {
      return await this.fullScopeModel.findOneAndDelete(query);
    } else {
      return await this.fullScopeModel.findOneAndUpdate(query, updateData, {
        new: true,
      });
    }
  }
  async addNestedToInternalEvent(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: modelId };
    const updateData = {
      $push: {
        [nestedType]: nestedId,
      },
    };
    const options = { new: true };
    return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
  }
  async addNestedToInternalHazard(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async addNestedToExternalHazard(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async addNestedToFullScope(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
  }
  async deleteNestedFromInternalEvent(
    modelId: string,
    nestedId: number | string,
    nestedType: string,
  ): Promise<TypedModelJSON> {
    const query: FilterQuery<InternalEventsDocument> = { id: Number(modelId) };
    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
  }
  async deleteNestedFromInternalHazard(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async deleteNestedFromExternalHazard(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
  }
  async deleteNestedFromFullScope(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    const query = { id: Number(modelId) };
    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };
    const options = { new: true };
    return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
  }
}
