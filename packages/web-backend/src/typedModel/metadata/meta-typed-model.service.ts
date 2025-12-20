import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InternalEvents,
  InternalEventsDocument,
  InternalEventsMetadata,
} from '../schemas/internal-events.schema';

/**
 * Service exposing metadata queries for typed models.
 * @public
 */
@Injectable()
export class MetaTypedModelService {
  /**
   * Create the metadata service with the injected Internal Events model.
   *
   * @param internalEventsModel - Mongoose model used to query Internal Events metadata
   */
  constructor(
    @InjectModel(InternalEvents.name)
    private readonly internalEventsModel: Model<InternalEventsDocument>,
  ) {}

  //GET functions
  /**
   * function to return all the metadata of the desired model type of a given user
   * @param userId - the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalEventsMetaData(
    userId: number,
  ): Promise<InternalEventsMetadata[]> {
    const valuesToSelect = ['label', 'users'];

    return this.internalEventsModel
      .find({ users: userId })
      .select(valuesToSelect);
  }
}

//GET functions
