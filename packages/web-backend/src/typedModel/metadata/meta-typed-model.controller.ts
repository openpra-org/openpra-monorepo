import {
  Controller,
  Get,
  Request,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InternalEventsMetadata } from "../schemas/internal-events.schema";
import { InvalidTokenFilter } from "../../filters/invalid-token.filter";
import { MetaTypedModelService } from "./meta-typed-model.service";

@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class MetaTypedModelController {
  constructor(private readonly metaTypedModelService: MetaTypedModelService) {}
  //get methods for collections

  /**
   *
   * @param id the id of the user whose models you want to retrieve
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get("/metadata/internal-events/")
  async getInternalEvents(@Request() req): Promise<InternalEventsMetadata[]> {
    console.log("here");
    return this.metaTypedModelService.getInternalEventsMetaData(
      req.user.user_id,
    );
  }
}
