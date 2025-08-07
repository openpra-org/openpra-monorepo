import { Injectable } from "@nestjs/common";
import {
  TypedModelDeleteRequest,
  TypedModelGetRequest,
  TypedModelNestedDeleteRequest,
  TypedModelNestedPatchRequest,
  TypedModelPatchRequest,
  TypedModelPostRequest,
} from "shared-types/src/openpra-mef-types/api/TypedModelRequest";
import { TypedModel } from "shared-types/src/openpra-mef-types/modelTypes/largeModels/TypedModel";
import { ModelFactoryService } from "./modelFactory.service";

@Injectable()
export class TypedModelService {
  constructor(private readonly modelFactory: ModelFactoryService) {}

  // Get Typed Models
  async getTypedModels(typedModelReq: TypedModelGetRequest): Promise<TypedModel[]> {
    const model = this.modelFactory.getModel(typedModelReq.typedModelName);
    return model.find({ users: typedModelReq.userId });
  }

  // Get Typed Model by ID
  async getTypedModel(typedModelReq: TypedModelGetRequest, modelId: string): Promise<TypedModel> {
    const model = this.modelFactory.getModel(typedModelReq.typedModelName);
    return model.findOne({ _id: modelId, users: typedModelReq.userId });
  }

  // Create Typed Model
  async createTypedModel(typedModel: TypedModelPostRequest): Promise<TypedModel> {
    const model = this.modelFactory.getModel(typedModel.typedModelName);
    const newTypedModel = new model({ label: typedModel.label, users: typedModel.users });
    return newTypedModel.save();
  }

  // Edit Typed Model
  async patchTypedModel(modelId: string, typedModelReq: TypedModelPatchRequest): Promise<TypedModel> {
    // Find the document that matches the provided modelId and userId
    const query = { _id: modelId, users: typedModelReq.userId };

    const model = this.modelFactory.getModel(typedModelReq.typedModelName);
    const newTypedModel = new model(typedModelReq.typedModel);

    const updateData = {
      users: newTypedModel.users,
      label: newTypedModel.label,
    };

    const options = { new: true };

    return await model.findOneAndUpdate(query, updateData, options);
  }

  async deleteTypedModel(modelId: string, typedModelReq: TypedModelDeleteRequest): Promise<TypedModel> {
    const query = { _id: modelId };
    const model = this.modelFactory.getModel(typedModelReq.typedModelName);

    // To remove the userId from the list of users for the typed model
    const updateData = {
      $pull: {
        users: typedModelReq.userId,
      },
    };

    const result = await model.findOne(query);
    if (result.users.length == 1) {
      return await model.findOneAndDelete(query);
    } else {
      return await model.findOneAndUpdate(query, updateData, { new: true }).lean();
    }
  }

  // Add Nested Model to a Typed Model
  async addNestedToTypedModel(modelId: string, typedModelReq: TypedModelNestedPatchRequest): Promise<TypedModel> {
    // Find the document that matches the provided modelId and userId
    const query = { _id: modelId };
    const model = this.modelFactory.getModel(typedModelReq.typedModelName);

    const updateData = {
      $push: {
        [typedModelReq.nestedModelType]: typedModelReq.nestedModelId,
      },
    };

    const options = { new: true };

    return model.findOneAndUpdate(query, updateData, options);
  }

  // Delete Nested Model from a Typed Model
  async deleteNestedFromTypedModel(modelId: string, typedModelReq: TypedModelNestedDeleteRequest): Promise<TypedModel> {
    const query = { _id: modelId };
    const model = this.modelFactory.getModel(typedModelReq.typedModelName);

    const updateData = {
      $pull: {
        [typedModelReq.nestedModelType]: typedModelReq.nestedModelId,
      },
    };

    const options = { new: true };

    return model.findOneAndUpdate(query, updateData, options);
  }
}
