import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ModelViewColumn,
  ModelViewColumnDocument,
} from "./schemas/columnsConfig.schema";

import {
  Initiator,
  InitiatorDocument,
} from "../initiators/schemas/initiator.schema";

import {
  InitiatingEvent,
  InitiatingEventDocument,
} from "../nestedModels/schemas/initiating-event.schema";

@Injectable()
export class ModelViewColumnService {
  constructor(
    @InjectModel(ModelViewColumn.name)
    private readonly modelViewColumnModel: Model<ModelViewColumnDocument>,
    @InjectModel(Initiator.name)
    private readonly initiatorModel: Model<InitiatorDocument>,
    @InjectModel(InitiatingEvent.name)
    private readonly initiatingEventModel: Model<InitiatingEventDocument>,
  ) {}

  async addColumn(column: ModelViewColumn): Promise<ModelViewColumnDocument> {
    const allInitiators = await this.initiatorModel.find();
    const allInitiatingEvents = await this.initiatingEventModel.find();
    allInitiators.forEach(async (initiator) => {
      this.addKeyValueMapping(column, initiator);
    });
    allInitiatingEvents.forEach(async (initiatingEvent) => {
      this.addKeyValueMapping(column, initiatingEvent);
    });

    return await new this.modelViewColumnModel(column).save();
  }

  async addKeyValueMapping(
    column,
    model: InitiatingEventDocument | InitiatorDocument,
  ) {
    if (column.type == "string") {
      model[column.name] = "";
    } else if (column.type == "dropdown") {
      if (column.dropdownOptions.length > 0) {
        model[column.name] = column.dropdownOptions[0];
      } else {
        model[column.name] = "";
      }
    } else {
      model[column.name] = 0;
    }
    await model.save();
  }

  async deleteColumn(
    columnName: string,
  ): Promise<ModelViewColumnDocument | null> {
    const allInitiators = await this.initiatorModel.find();
    const allInitiatingEvents = await this.initiatingEventModel.find();
    allInitiators.forEach(async (initiator) => {
      this.removeKeyValueMapping(columnName, initiator);
    });

    allInitiatingEvents.forEach(async (initiatingEvent) => {
      this.removeKeyValueMapping(columnName, initiatingEvent);
    });

    return await this.modelViewColumnModel.findOneAndDelete({
      name: columnName,
    });
  }

  async removeKeyValueMapping(columnName, model: InitiatingEventDocument | InitiatorDocument) {
    delete model[columnName];
    await model.save();
  }

  async updateColumnName(columnName: string, newName: string) {
    return await this.modelViewColumnModel.findOneAndUpdate(
      { name: columnName },
      { name: newName },
      { new: true },
    );
  }

  async updateColumn(
    columnName: string,
    newColumnObject: ModelViewColumn,
  ): Promise<ModelViewColumn | null> {
    return await this.modelViewColumnModel.findOneAndUpdate(
      { name: columnName },
      newColumnObject,
      { new: true },
    );
  }
}
