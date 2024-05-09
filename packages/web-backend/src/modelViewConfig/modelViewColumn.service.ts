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
    const valueforColumn = this.valueforColumn(column);
    for (const initiator of allInitiators) {

      const updatedInitiator = await this.initiatorModel.findByIdAndUpdate(
        initiator._id,
        {
          $set: {
            [`customAttributes.${column.name}`]: valueforColumn,
          },
        },
        { new: true },
      );
    }

    for (const initiatingEvent of allInitiatingEvents) {
      await this.initiatingEventModel.findByIdAndUpdate(
        initiatingEvent._id,
        {
          $set: {
            [`customAttributes.${column.name}`]: valueforColumn,
          },
        },
        { new: true },
      );
    }

    return await new this.modelViewColumnModel(column).save();
  }

  valueforColumn(
    column
  ) {
    if (column.type == "string") {
      return " ";
    } else if (column.type == "dropdown") {
      if (column.options.length > 0) {
        return column.options[0];
      } else {
        return " ";
      }
    } else {
      return 0;
    }
  }

  async deleteColumn(
    columnName: string,
  ): Promise<ModelViewColumnDocument | null> {
    const allInitiators = await this.initiatorModel.find();
    const allInitiatingEvents = await this.initiatingEventModel.find();
    allInitiators.forEach(async (initiator) => {
      await this.initiatorModel.findByIdAndUpdate(
        initiator._id,
        {
          $unset: {
            [`customAttributes.${columnName}`]: "",
          },
        },
        { new: true },
      );
    });


    allInitiatingEvents.forEach(async (initiatingEvent) => {
      await this.initiatingEventModel.findByIdAndUpdate(
        initiatingEvent._id,
        {
          $unset: {
            [`customAttributes.${columnName}`]: "",
          },
        },
        { new: true },
      );
    });

    return await this.modelViewColumnModel.findOneAndDelete({
      name: columnName,
    });
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
    if (columnName!=newColumnObject.name){
      const allInitiators = await this.initiatorModel.find();
      const allInitiatingEvents = await this.initiatingEventModel.find();
      const newColumnName = newColumnObject.name;
      for (const initiator of allInitiators) {
        //set the new column and unset the old column
        await this.initiatorModel.findByIdAndUpdate(
          initiator._id,
          {
            $rename: {
              ["customAttributes."+columnName]: "customAttributes."+newColumnName
            }
          },
          { new: true },
        )
      }
      for (const initiatingEvent of allInitiatingEvents) {
        await this.initiatingEventModel.findByIdAndUpdate(
          initiatingEvent._id,
          {
            $rename:{
              ["customAttributes."+columnName]: "customAttributes."+newColumnName
            }
          }
        );
      }
    }
    
    return await this.modelViewColumnModel.findOneAndUpdate(
      { name: columnName },
      newColumnObject,
      { new: true },
    );
  }
}
