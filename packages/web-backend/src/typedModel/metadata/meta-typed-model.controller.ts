import {
  Controller,
  Get,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { InternalEventsMetadata } from '../schemas/internal-events.schema';
import { InvalidTokenFilter } from '../../filters/invalid-token.filter';
import { MetaTypedModelService } from './meta-typed-model.service';

/**
 * Controller for typed model metadata queries.
 * Provides endpoints to list models accessible to a user.
 * @public
 */
@Controller()
@UseGuards(AuthGuard('jwt'))
@UseFilters(InvalidTokenFilter)
export class MetaTypedModelController {
  /**
   * @param metaTypedModelService - Service providing metadata access for typed models
   */
  constructor(private readonly metaTypedModelService: MetaTypedModelService) {}
  //get methods for collections

  /**
   *
   * @param req - the request providing the user id
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get('/metadata/internal-events/')
  async getInternalEvents(
    @Request() req: ExpressRequest,
  ): Promise<InternalEventsMetadata[]> {
    const userId: unknown = (req as unknown as { user?: { user_id?: unknown } })
      ?.user?.user_id;
    const idNum =
      typeof userId === 'number'
        ? userId
        : typeof userId === 'string'
          ? Number(userId)
          : undefined;
    return this.metaTypedModelService.getInternalEventsMetaData(
      idNum as number,
    );
  }
}
